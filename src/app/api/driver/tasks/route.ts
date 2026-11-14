import { NextRequest } from 'next/server';
import { requireRole, pushStatusHistory, DRIVER_TRANSITIONS } from '@/lib/portal';
import { expireStaleOffers } from '@/lib/dispatch';
import { sbList, sbOne, sbUpdate, sbInsert } from '@/lib/supabase';
import { jsonError } from '@/lib/api-user';

interface OrderRow {
  id: string;
  order_code: string;
  status: string;
  driver_id: string | null;
  delivery_fee: number;
  delivery_address_id: string | null;
  restaurant_id: string;
  created_at: string;
}

interface TaskRow {
  id: string;
  order_id: string;
  status: string;
}

/** GET /api/driver/tasks — งานพร้อมรับ (ร้านพร้อมส่ง ยังไม่มีคนรับ และไม่ได้อยู่ในรอบเสนองาน) + งานของฉัน */
export async function GET(_req: NextRequest) {
  const user = await requireRole('driver');
  if (!user) return jsonError('เฉพาะไรเดอร์เท่านั้น', 403);

  // D3: ยกเลิกข้อเสนอที่หมดอายุก่อน (lazy) — งานที่ยังมีข้อเสนอค้างอยู่จะไม่โผล่ในกองสาธารณะ
  await expireStaleOffers();
  const pendingOffers = await sbList<{ order_id: string }>('dispatch_offers', {
    status: 'eq.pending',
    expires_at: `gte.${new Date().toISOString()}`,
    select: 'order_id',
    limit: '200',
  });
  const offeredOrderIds = new Set(pendingOffers.map((o) => o.order_id));

  const allAvailable = await sbList<OrderRow>('orders', {
    status: 'eq.ready_for_pickup',
    driver_id: 'is.null',
    select: 'id,order_code,status,driver_id,delivery_fee,delivery_address_id,restaurant_id,created_at',
    order: 'created_at.asc',
    limit: '30',
  });
  const available = allAvailable.filter((o) => !offeredOrderIds.has(o.id));
  const mine = await sbList<OrderRow>('orders', {
    driver_id: `eq.${user.id}`,
    status: 'in.(driver_assigned,picked_up,delivering)',
    select: 'id,order_code,status,driver_id,delivery_fee,delivery_address_id,restaurant_id,created_at',
    order: 'created_at.asc',
    limit: '20',
  });

  // ชื่อร้าน + ที่อยู่ส่งของแต่ละออเดอร์
  const rstIds = [...new Set([...available, ...mine].map((o) => o.restaurant_id))];
  const addrIds = [...new Set([...available, ...mine].map((o) => o.delivery_address_id).filter((x): x is string => !!x))];
  const restaurants = rstIds.length
    ? await sbList<{ id: string; name: string; address_line: string | null }>('restaurants', {
        id: `in.(${rstIds.join(',')})`,
        select: 'id,name,address_line',
        limit: '100',
      })
    : [];
  const addresses = addrIds.length
    ? await sbList<{ id: string; address_line: string; label: string | null }>('addresses', {
        id: `in.(${addrIds.join(',')})`,
        select: 'id,address_line,label',
        limit: '100',
      })
    : [];

  const decorate = (o: OrderRow) => ({
    ...o,
    restaurantName: restaurants.find((r) => r.id === o.restaurant_id)?.name ?? '',
    restaurantAddress: restaurants.find((r) => r.id === o.restaurant_id)?.address_line ?? '',
    dropoffAddress: addresses.find((a) => a.id === o.delivery_address_id)?.address_line ?? '',
    dropoffLabel: addresses.find((a) => a.id === o.delivery_address_id)?.label ?? '',
  });

  return Response.json({
    available: available.map(decorate),
    mine: mine.map(decorate),
  });
}

/**
 * POST /api/driver/tasks — ไรเดอร์ดำเนินการกับงาน
 * { orderId, action: 'accept' | 'pickup' | 'deliver' }
 * accept: จองออเดอร์ (คนแรกเท่านั้น) → driver_assigned + สร้าง delivery_tasks
 * pickup: รับอาหารแล้ว → picked_up
 * deliver: ส่งถึงลูกค้าแล้ว → delivered + สถิติไรเดอร์
 */
export async function POST(req: NextRequest) {
  const user = await requireRole('driver');
  if (!user) return jsonError('เฉพาะไรเดอร์เท่านั้น', 403);
  const profile = await sbOne<{ id: string; is_online: boolean }>('driver_profiles', {
    user_id: `eq.${user.id}`,
    select: 'id,is_online',
  });
  if (!profile) return jsonError('ยังไม่มีโปรไฟล์ไรเดอร์สำหรับบัญชีนี้', 404);

  const { orderId, action } = (await req.json().catch(() => ({}))) as { orderId?: string; action?: string };
  if (!orderId || !action) return jsonError('กรุณาระบุ orderId และ action', 400);

  const order = await sbOne<OrderRow>('orders', {
    id: `eq.${orderId}`,
    select: 'id,order_code,status,driver_id,delivery_fee,delivery_address_id,restaurant_id,created_at',
  });
  if (!order) return jsonError('ไม่พบคำสั่งซื้อ', 404);

  const next = DRIVER_TRANSITIONS[order.status]?.[action];
  if (!next) return jsonError(`ทำรายการนี้ไม่ได้ — ออเดอร์อยู่สถานะ ${order.status}`, 400);

  if (action === 'accept') {
    if (!profile.is_online) return jsonError('ต้องเปิดรับงานก่อนจึงจะรับออเดอร์ได้', 400);
    // ตำแหน่งรับ/ส่ง (geography hex EWKB จากฐานข้อมูล)
    const rst = await sbOne<{ location: string }>('restaurants', {
      id: `eq.${order.restaurant_id}`,
      select: 'location',
    });
    const addr = order.delivery_address_id
      ? await sbOne<{ location: string }>('addresses', { id: `eq.${order.delivery_address_id}`, select: 'location' })
      : null;
    // จองแบบ atomic: อัปเดตได้เฉพาะเมื่อยังไม่มีใครรับ (ตัวเช็คจากสถานะ + driver_id เดิม)
    const [updated] = await sbUpdate<{ id: string }>(
      'orders',
      { id: `eq.${orderId}`, status: 'eq.ready_for_pickup', driver_id: 'is.null' },
      { driver_id: user.id, status: 'driver_assigned', updated_at: new Date().toISOString() },
    );
    if (!updated) return jsonError('มีไรเดอร์รับงานนี้ก่อนแล้ว', 409);
    await sbInsert('delivery_tasks', {
      order_id: orderId,
      driver_id: user.id,
      status: 'assigned',
      assigned_at: new Date().toISOString(),
      ...(rst?.location ? { pickupLocation: rst.location } : {}),
      ...(addr?.location ? { dropoffLocation: addr.location } : {}),
    });
    await pushStatusHistory(orderId, 'driver_assigned', user.id, 'ไรเดอร์รับงาน');
    return Response.json({ ok: true, status: 'driver_assigned' });
  }

  if (action === 'pickup') {
    const [updated] = await sbUpdate<{ id: string }>(
      'orders',
      { id: `eq.${orderId}`, status: 'eq.driver_assigned', driver_id: `eq.${user.id}` },
      { status: 'picked_up', updated_at: new Date().toISOString() },
    );
    if (!updated) return jsonError('สถานะถูกเปลี่ยนไปก่อนแล้ว กรุณารีเฟรช', 409);
    await sbUpdate('delivery_tasks', { order_id: `eq.${orderId}`, driver_id: `eq.${user.id}` }, {
      status: 'picked_up',
      picked_up_at: new Date().toISOString(),
    });
    await pushStatusHistory(orderId, 'picked_up', user.id, 'ไรเดอร์รับอาหารจากร้าน');
    return Response.json({ ok: true, status: 'picked_up' });
  }

  // deliver
  const [updated] = await sbUpdate<{ id: string }>(
    'orders',
    { id: `eq.${orderId}`, status: 'eq.picked_up', driver_id: `eq.${user.id}` },
    { status: 'delivered', actual_delivery_time_minutes: 30, updated_at: new Date().toISOString() },
  );
  if (!updated) return jsonError('สถานะถูกเปลี่ยนไปก่อนแล้ว กรุณารีเฟรช', 409);
  await sbUpdate('delivery_tasks', { order_id: `eq.${orderId}`, driver_id: `eq.${user.id}` }, {
    status: 'delivered',
    delivered_at: new Date().toISOString(),
  });
  // สถิติไรเดอร์: จำนวนไรด์ + รายได้ (ค่าส่งเป็นสตางค์)
  const prof = await sbOne<{ total_deliveries: number | null; total_earnings: number | null }>('driver_profiles', {
    user_id: `eq.${user.id}`,
    select: 'total_deliveries,total_earnings',
  });
  await sbUpdate('driver_profiles', { user_id: `eq.${user.id}` }, {
    total_deliveries: (prof?.total_deliveries ?? 0) + 1,
    total_earnings: Number(prof?.total_earnings ?? 0) + Number(order.delivery_fee),
  });
  await pushStatusHistory(orderId, 'delivered', user.id, 'ไรเดอร์ส่งอาหารถึงลูกค้าแล้ว');
  return Response.json({ ok: true, status: 'delivered' });
}
