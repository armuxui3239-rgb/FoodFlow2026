import { sbList, sbOne, sbUpdate } from '@/lib/supabase';
import { currentUser, jsonError } from '@/lib/api-user';

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return jsonError('กรุณาเข้าสู่ระบบ', 401);
  const { id } = await ctx.params;
  const order = await sbOne<Record<string, unknown>>('orders', {
    id: `eq.${id}`,
    customer_id: `eq.${user.id}`,
    select: '*,restaurants(name,logo_url,phone),order_items(id,name_snapshot,quantity,unit_price)',
  });
  if (!order) return jsonError('ไม่พบคำสั่งซื้อ', 404);
  const payments = await sbList<{ id: string; status: string; amount: number }>('payments', {
    order_id: `eq.${id}`,
    select: 'id,status,amount',
    order: 'created_at.desc',
    limit: '1',
  });
  return Response.json({ order, payment: payments[0] ?? null });
}
