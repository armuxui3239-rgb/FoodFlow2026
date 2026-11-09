import { sbInsert, sbOne, sbUpdate } from '@/lib/supabase';
import { currentUser, jsonError } from '@/lib/api-user';

/** สถานะที่ลูกค้ายกเลิกเองได้ — ก่อนร้านตอบรับออเดอร์เท่านั้น */
const CANCELLABLE_STATUSES = ['created', 'pending_payment', 'restaurant_pending'];

/** POST — ยกเลิกคำสั่งซื้อของตัวเอง (เฉพาะสถานะที่ยกเลิกได้) */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return jsonError('กรุณาเข้าสู่ระบบ', 401);

  const { id } = await ctx.params;
  const order = await sbOne<{ id: string; order_code: string; status: string }>('orders', {
    id: `eq.${id}`,
    customer_id: `eq.${user.id}`,
    select: 'id,order_code,status',
  });
  if (!order) return jsonError('ไม่พบคำสั่งซื้อ', 404);
  if (!CANCELLABLE_STATUSES.includes(order.status)) {
    return jsonError('ไม่สามารถยกเลิกได้ในสถานะนี้', 409);
  }

  await sbUpdate(
    'orders',
    { id: `eq.${order.id}` },
    {
      status: 'cancelled',
      cancelled_reason: 'ยกเลิกโดยลูกค้า',
      updated_at: new Date().toISOString(),
    },
  );

  await sbInsert('order_status_history', {
    order_id: order.id,
    status: 'cancelled',
    changed_by: user.id,
    note: 'ยกเลิกโดยลูกค้า',
    created_at: new Date().toISOString(),
  });

  return Response.json({ data: { ok: true } });
}
