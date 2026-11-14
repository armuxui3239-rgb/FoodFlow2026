import { NextRequest } from 'next/server';
import { currentUser, jsonError } from '@/lib/api-user';
import { checkPromotion } from '@/lib/promotion';
import { loadCart } from '@/lib/cart-server';

const DELIVERY_FEE = 3500; // สตางค์ตามมาตรฐานฐานข้อมูล (฿35)

/**
 * POST /api/promotions/validate
 * body: { code: string; subtotal: number } — subtotal เป็นสตางค์จากตะกร้าจริง
 * ตรวจเงื่อนไขคูปองทุกข้อจากฐานข้อมูล (ไม่หักเงินจริง ใช้ก่อนกดยืนยัน)
 * ผูกร้านให้ตรงกับตะกร้าจริงของผู้ใช้ — เพื่อไม่บอกลูกค้าว่า "ใช้ได้" แล้วตอนสั่งจริงโดนปฏิเสธ (P0)
 */
export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user) return jsonError('กรุณาเข้าสู่ระบบ', 401);
  const { code, subtotal } = (await req.json().catch(() => ({}))) as { code?: string; subtotal?: number };
  if (typeof subtotal !== 'number' || subtotal <= 0) {
    return jsonError('ยอดสั่งซื้อไม่ถูกต้อง', 400);
  }
  const cartData = await loadCart(user.id);
  const restaurantId = cartData?.cart?.restaurant_id ?? null;
  const result = await checkPromotion(code ?? '', subtotal, DELIVERY_FEE, user.id, restaurantId);
  if (!result.ok) {
    return Response.json({ valid: false, error: result.error }, { status: 200 });
  }
  return Response.json({
    valid: true,
    code: result.promotion.code,
    discount: result.discount,
    message: result.message,
  });
}
