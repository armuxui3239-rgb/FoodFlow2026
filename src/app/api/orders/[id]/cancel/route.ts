import { sbInsert, sbOne, sbUpdate } from '@/lib/supabase';
import { currentUser, jsonError } from '@/lib/api-user';

/** สถานะที่ลูกค้ายกเลิกเองได้ — ก่อนร้านตอบรับออเดอร์เท่านั้น */
const CANCELLABLE_STATUSES = ['created', 'pending_payment', 'restaurant_pending'];

/** POST — ยกเลิกคำสั่งซื้อของตัวเอง body: { reasonId } — เหตุผลจากตารางที่แอดมินจัดการ (v4 ข้อ 8.11) */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return jsonError('กรุณาเข้าสู่ระบบ', 401);

  const { id } = await ctx.params;
  const { reasonId } = (await req.json().catch(() => ({}))) as { reasonId?: string };
  const order = await sbOne<{ id: string; order_code: string; status: string }>('orders', {
    id: `eq.${id}`,
    customer_id: `eq.${user.id}`,
    select: 'id,order_code,status',
  });
  if (!order) return jsonError('ไม่พบคำสั่งซื้อ', 404);
  if (!CANCELLABLE_STATUSES.includes(order.status)) {
    return jsonError('ไม่สามารถยกเลิกได้ในสถานะนี้', 409);
  }

  // เหตุผลต้องมาจากรายการที่แอดมินเปิดใช้งานเท่านั้น (v4 ข้อ 8.11)
  if (!reasonId) return jsonError('กรุณาเลือกเหตุผลการยกเลิก', 400);
  const reason = await sbOne<{ label: string }>('cancellation_reasons', {
    id: `eq.${reasonId}`,
    is_active: 'eq.true',
    select: 'label',
  });
  if (!reason) return jsonError('เหตุผลการยกเลิกไม่ถูกต้อง', 400);

  await sbUpdate(
    'orders',
    { id: `eq.${order.id}` },
    {
      status: 'cancelled',
      cancelled_reason: reason.label,
      updated_at: new Date().toISOString(),
    },
  );

  await sbInsert('order_status_history', {
    order_id: order.id,
    status: 'cancelled',
    changed_by: user.id,
    note: reason.label,
    created_at: new Date().toISOString(),
  });

  return Response.json({ data: { ok: true } });
}
