import { NextRequest } from 'next/server';
import { requireRole, pushStatusHistory } from '@/lib/portal';
import { sbList, sbOne, sbUpdate, sbHeaders } from '@/lib/supabase';
import { jsonError } from '@/lib/api-user';

/** สถานะปลายทาง — เปลี่ยนต่อไม่ได้อีก */
const TERMINAL_STATUSES = ['cancelled', 'refunded'];

/** ลำดับการเปลี่ยนสถานะที่แอดมินอนุญาต (นอกเหนือจาก "ยกเลิกได้จากทุกสถานะที่ยังไม่จบ") */
const ADMIN_TRANSITIONS: Record<string, string[]> = {
  created: ['cancelled'],
  pending_payment: ['cancelled'],
  paid: ['restaurant_pending', 'restaurant_accepted'],
  restaurant_pending: ['restaurant_accepted'],
  restaurant_accepted: ['preparing'],
  preparing: ['ready_for_pickup'],
  ready_for_pickup: ['driver_assigned'],
  driver_assigned: ['picked_up'],
  driver_arriving_restaurant: ['picked_up'],
  picked_up: ['delivering'],
  delivering: ['delivered'],
  delivered: ['completed'],
  completed: [],
};

interface OrderRow {
  id: string;
  order_code: string;
  customer_id: string;
  restaurant_id: string;
  driver_id: string | null;
  delivery_address_id: string;
  status: string;
  subtotal: number;
  delivery_fee: number;
  promotion_discount: number;
  total: number;
  payment_method: string;
  notes: string | null;
  cancelled_reason: string | null;
  estimated_prep_time_minutes: number | null;
  estimated_delivery_time_minutes: number | null;
  actual_delivery_time_minutes: number | null;
  created_at: string;
  updated_at: string;
}

/** บันทึก admin_audit_logs (id เป็น BIGSERIAL จึงใส่ค่าเองไม่ได้ — ใช้ fetch ตรงเพื่อไม่ให้ sbInsert เติม uuid) */
async function logAudit(
  adminId: string,
  action: string,
  targetType: string,
  targetId: string | null,
  req: NextRequest,
  oldValue?: unknown,
  newValue?: unknown,
): Promise<void> {
  const row: Record<string, unknown> = {
    admin_id: adminId,
    action,
    target_type: targetType,
    ...(targetId ? { target_id: targetId } : {}),
    ...(oldValue !== undefined ? { old_value: oldValue as never } : {}),
    ...(newValue !== undefined ? { new_value: newValue as never } : {}),
    ip_address: (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || '0.0.0.0',
    severity: 'info',
    created_at: new Date().toISOString(),
  };
  try {
    await fetch(`${process.env.SUPABASE_URL}/rest/v1/admin_audit_logs`, {
      method: 'POST',
      headers: { ...sbHeaders(), Prefer: 'return=minimal' },
      body: JSON.stringify([row]),
    });
  } catch {
    // บันทึกตรวจสอบล้มเหลวต้องไม่ทำให้การทำงานหลักล้ม
  }
}

/** GET /api/admin/orders/[id] — รายละเอียดออเดอร์เต็ม (รายการอาหาร การชำระเงิน ลูกค้า ร้าน ไรเดอร์ ประวัติสถานะ) */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const admin = await requireRole('admin');
  if (!admin) return jsonError('เฉพาะผู้ดูแลระบบเท่านั้น', 403);
  const { id } = await ctx.params;

  const order = await sbOne<OrderRow>('orders', {
    id: `eq.${id}`,
    select:
      'id,order_code,customer_id,restaurant_id,driver_id,delivery_address_id,status,subtotal,delivery_fee,promotion_discount,total,payment_method,notes,cancelled_reason,estimated_prep_time_minutes,estimated_delivery_time_minutes,actual_delivery_time_minutes,created_at,updated_at',
  });
  if (!order) return jsonError('ไม่พบคำสั่งซื้อ', 404);

  const [restaurants, items, payments, history, addresses] = await Promise.all([
    sbList<{ id: string; name: string; phone: string | null; logo_url: string | null; address_line: string; city: string }>('restaurants', {
      id: `eq.${order.restaurant_id}`,
      select: 'id,name,phone,logo_url,address_line,city',
      limit: '1',
    }),
    sbList<{ id: string; name_snapshot: string; quantity: number; unit_price: number; notes: string | null; selected_options: unknown }>('order_items', {
      order_id: `eq.${id}`,
      select: 'id,name_snapshot,quantity,unit_price,notes,selected_options',
      limit: '100',
    }),
    sbList<{ id: string; amount: number; method: string; status: string; transaction_id: string; paid_at: string | null; created_at: string }>('payments', {
      order_id: `eq.${id}`,
      select: 'id,amount,method,status,transaction_id,paid_at,created_at',
      order: 'created_at.desc',
      limit: '1',
    }),
    sbList<{ id: string; status: string; changed_by: string; note: string | null; created_at: string }>('order_status_history', {
      order_id: `eq.${id}`,
      select: 'id,status,changed_by,note,created_at',
      order: 'created_at.asc',
      limit: '100',
    }),
    sbList<{ id: string; label: string; address_line: string }>('addresses', {
      id: `eq.${order.delivery_address_id}`,
      select: 'id,label,address_line',
      limit: '1',
    }),
  ]);

  const userIds = [order.customer_id, order.driver_id].filter((x): x is string => Boolean(x));
  const users = userIds.length
    ? await sbList<{ id: string; full_name: string; email: string; phone: string | null; role: string }>('users', {
        id: `in.(${userIds.join(',')})`,
        select: 'id,full_name,email,phone,role',
        limit: '10',
      })
    : [];

  const driverProfile = order.driver_id
    ? await sbOne<{ id: string; vehicle_type: string; vehicle_plate: string | null; rating: number; total_deliveries: number }>('driver_profiles', {
        user_id: `eq.${order.driver_id}`,
        select: 'id,vehicle_type,vehicle_plate,rating,total_deliveries',
        limit: '1',
      })
    : null;

  return Response.json({
    order: {
      ...order,
      restaurant: restaurants[0] ?? null,
      items,
      payment: payments[0] ?? null,
      address: addresses[0] ?? null,
      customer: users.find((u) => u.id === order.customer_id) ?? null,
      driver: order.driver_id ? users.find((u) => u.id === order.driver_id) ?? null : null,
      driverProfile,
      statusHistory: history,
    },
  });
}

/**
 * PATCH /api/admin/orders/[id] — เปลี่ยนสถานะออเดอร์ (แอดมิน)
 * { status, reason? } — ยกเลิกต้องระบุเหตุผล, ตรวจสถานะปัจจุบันก่อนเสมอ
 */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const admin = await requireRole('admin');
  if (!admin) return jsonError('เฉพาะผู้ดูแลระบบเท่านั้น', 403);
  const { id } = await ctx.params;
  const { status, reason } = (await req.json().catch(() => ({}))) as { status?: string; reason?: string };
  if (!status) return jsonError('กรุณาระบุสถานะใหม่', 400);

  const order = await sbOne<Pick<OrderRow, 'id' | 'order_code' | 'status' | 'cancelled_reason'>>('orders', {
    id: `eq.${id}`,
    select: 'id,order_code,status,cancelled_reason',
  });
  if (!order) return jsonError('ไม่พบคำสั่งซื้อ', 404);

  const current = order.status;
  const isCancel = status === 'cancelled';
  const allowed = ADMIN_TRANSITIONS[current] ?? [];
  if (!isCancel && !allowed.includes(status)) {
    return jsonError(`เปลี่ยนสถานะจาก "${current}" เป็น "${status}" ไม่ได้ตามลำดับการทำงาน`, 400);
  }
  if (isCancel && TERMINAL_STATUSES.includes(current)) {
    return jsonError('ออเดอร์นี้จบการทำงานแล้ว จึงยกเลิกไม่ได้', 400);
  }
  if (isCancel && !reason?.trim()) return jsonError('กรุณาระบุเหตุผลการยกเลิก', 400);

  const [updated] = await sbUpdate<{ id: string; status: string; cancelled_reason: string | null }>(
    'orders',
    { id: `eq.${id}` },
    {
      status,
      ...(isCancel ? { cancelled_reason: reason!.trim() } : {}),
      updated_at: new Date().toISOString(),
    },
  );
  if (!updated) return jsonError('ไม่พบคำสั่งซื้อ', 404);

  await pushStatusHistory(id, status, `admin:${admin.email}`, isCancel ? reason!.trim() : undefined);
  await logAudit(admin.id, 'order.status_change', 'order', id, req, { status: current }, {
    status,
    ...(isCancel ? { cancelled_reason: reason!.trim() } : {}),
  });

  return Response.json({ ok: true, order: updated });
}
