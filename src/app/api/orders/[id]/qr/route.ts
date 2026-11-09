import QRCode from 'qrcode';
import { sbOne } from '@/lib/supabase';
import { currentUser, jsonError } from '@/lib/api-user';
import { promptPayPayload } from '@/lib/promptpay';

const FALLBACK_PROMPTPAY = '0812345678';

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return jsonError('กรุณาเข้าสู่ระบบ', 401);
  const { id } = await ctx.params;
  const order = await sbOne<{ id: string; total: number; status: string; restaurant_id: string }>('orders', {
    id: `eq.${id}`,
    customer_id: `eq.${user.id}`,
    select: 'id,total,status,restaurant_id',
  });
  if (!order) return jsonError('ไม่พบคำสั่งซื้อ', 404);
  if (order.status !== 'pending_payment') return jsonError('คำสั่งซื้อนี้ชำระเงินแล้ว', 400);
  const restaurant = await sbOne<{ phone: string | null }>('restaurants', {
    id: `eq.${order.restaurant_id}`,
    select: 'phone',
  });
  const target =
    restaurant?.phone && restaurant.phone.replace(/\D/g, '').length >= 9
      ? restaurant.phone
      : FALLBACK_PROMPTPAY;
  const payload = promptPayPayload(target, order.total);
  const qrImage = await QRCode.toDataURL(payload, { width: 320, margin: 1 });
  return Response.json({ qrImage, payload, amount: order.total });
}
