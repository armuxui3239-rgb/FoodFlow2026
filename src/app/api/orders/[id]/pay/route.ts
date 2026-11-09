import { sbOne, sbUpdate } from '@/lib/supabase';
import { currentUser, jsonError } from '@/lib/api-user';

/** Manual payment confirmation (admin-style confirm — security hardening later per user instruction) */
export async function PATCH(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return jsonError('กรุณาเข้าสู่ระบบ', 401);
  const { id } = await ctx.params;
  const order = await sbOne<{ id: string; status: string }>('orders', {
    id: `eq.${id}`,
    customer_id: `eq.${user.id}`,
    select: 'id,status',
  });
  if (!order) return jsonError('ไม่พบคำสั่งซื้อ', 404);
  if (order.status !== 'pending_payment') {
    return Response.json({ ok: true, status: order.status });
  }
  await sbUpdate('payments', { order_id: `eq.${id}`, status: 'eq.pending' }, {
    status: 'completed',
    paid_at: new Date().toISOString(),
  });
  const [updated] = await sbUpdate<{ id: string; status: string }>(
    'orders',
    { id: `eq.${id}` },
    { status: 'paid', updated_at: new Date().toISOString() },
  );
  return Response.json({ ok: true, status: updated.status });
}
