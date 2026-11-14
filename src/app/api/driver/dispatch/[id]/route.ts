import { NextRequest } from 'next/server';
import { requireRole, pushStatusHistory } from '@/lib/portal';
import { expireStaleOffers } from '@/lib/dispatch';
import { sbList, sbOne, sbUpdate, sbInsert } from '@/lib/supabase';
import { jsonError } from '@/lib/api-user';

interface OfferRow {
  id: string;
  order_id: string;
  driver_id: string;
  status: string;
  expires_at: string;
}

interface OrderRow {
  id: string;
  order_code: string;
  status: string;
  driver_id: string | null;
  restaurant_id: string;
  delivery_address_id: string | null;
}

/** POST /api/driver/dispatch/[id] — ตอบข้อเสนองาน body: { action: 'accept' | 'reject' }
 *  accept = atomic คนแรกเท่านั้น: ข้อเสนอ -> accepted -> ผูกงาน+ออเดอร์ (เหมือน pool claim)
 *  แล้วปิดข้อเสนออื่น ๆ ของออเดอร์เดียวกันทันที (v4 ข้อ 3 / REMAINING-WORK D3) */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await requireRole('driver');
  if (!user) return jsonError('เฉพาะไรเดอร์เท่านั้น', 403);

  await expireStaleOffers();

  const { id } = await ctx.params;
  const { action } = (await req.json().catch(() => ({}))) as { action?: string };
  if (action !== 'accept' && action !== 'reject') {
    return jsonError('การกระทำไม่ถูกต้อง (accept/reject)', 400);
  }

  const profile = await sbOne<{ is_online: boolean }>('driver_profiles', {
    user_id: `eq.${user.id}`,
    select: 'is_online',
  });
  if (!profile) return jsonError('ยังไม่มีโปรไฟล์ไรเดอร์สำหรับบัญชีนี้', 404);
  if (action === 'accept' && !profile.is_online) {
    return jsonError('ต้องเปิดรับงานก่อนจึงจะรับออเดอร์ได้', 400);
  }

  const nextStatus = action === 'accept' ? 'accepted' : 'rejected';

  // atomic: ข้อเสนอต้องยัง pending + เป็นของฉัน + ยังไม่หมดอายุ
  const [offer] = await sbUpdate<{ id: string; order_id: string }>(
    'dispatch_offers',
    {
      id: `eq.${id}`,
      driver_id: `eq.${user.id}`,
      status: 'eq.pending',
      expires_at: `gte.${new Date().toISOString()}`,
    },
    { status: nextStatus, responded_at: new Date().toISOString(), updated_at: new Date().toISOString() },
  );
  if (!offer) return jsonError('ข้อเสนอหมดอายุหรือมีไรเดอร์รับไปก่อนแล้ว', 409);

  if (action === 'reject') {
    return Response.json({ ok: true, status: 'rejected' });
  }

  // ---- accept: ผูกงานแบบ atomic (ตรรกะเดียวกับ pool claim) ----
  const order = await sbOne<OrderRow>('orders', {
    id: `eq.${offer.order_id}`,
    select: 'id,order_code,status,driver_id,restaurant_id,delivery_address_id',
  });
  if (!order) return jsonError('ไม่พบคำสั่งซื้อของข้อเสนอนี้', 404);
  if (order.status !== 'ready_for_pickup' || order.driver_id) {
    // สถานะเปลี่ยนไปก่อนแล้ว (เช่น แอดมินจัดคน) — ปิดข้อเสนอและแจ้ง
    await sbUpdate('dispatch_offers', { id: `eq.${offer.id}` }, { status: 'expired', updated_at: new Date().toISOString() });
    return jsonError('ออเดอร์นี้มีไรเดอร์หรือเปลี่ยนสถานะไปก่อนแล้ว', 409);
  }

  const rst = await sbOne<{ location: string }>('restaurants', {
    id: `eq.${order.restaurant_id}`,
    select: 'location',
  });
  const addr = order.delivery_address_id
    ? await sbOne<{ location: string }>('addresses', { id: `eq.${order.delivery_address_id}`, select: 'location' })
    : null;

  const [updated] = await sbUpdate<{ id: string }>(
    'orders',
    { id: `eq.${order.id}`, status: 'eq.ready_for_pickup', driver_id: 'is.null' },
    { driver_id: user.id, status: 'driver_assigned', updated_at: new Date().toISOString() },
  );
  if (!updated) {
    await sbUpdate('dispatch_offers', { id: `eq.${offer.id}` }, { status: 'expired', updated_at: new Date().toISOString() });
    return jsonError('มีไรเดอร์รับงานนี้ก่อนแล้ว', 409);
  }
  await sbInsert('delivery_tasks', {
    order_id: order.id,
    driver_id: user.id,
    status: 'assigned',
    assigned_at: new Date().toISOString(),
    ...(rst?.location ? { pickupLocation: rst.location } : {}),
    ...(addr?.location ? { dropoffLocation: addr.location } : {}),
  });
  await pushStatusHistory(order.id, 'driver_assigned', user.id, 'ไรเดอร์รับงานจากข้อเสนอ (dispatch)');

  // ปิดข้อเสนออื่น ๆ ของออเดอร์เดียวกัน — คนอื่นเห็นว่างานถูกรับไปแล้ว
  await sbUpdate(
    'dispatch_offers',
    { order_id: `eq.${order.id}`, status: 'eq.pending', driver_id: `neq.${user.id}` },
    { status: 'expired', updated_at: new Date().toISOString() },
  );

  return Response.json({ ok: true, status: 'driver_assigned', orderCode: order.order_code });
}
