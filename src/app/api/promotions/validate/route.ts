import { NextRequest } from 'next/server';
import { currentUser, jsonError } from '@/lib/api-user';
import { checkPromotion } from '@/lib/promotion';

const DELIVERY_FEE = 3500; // สตางค์ตามมาตรฐานฐานข้อมูล (฿35)

/**
 * POST /api/promotions/validate
 * body: { code: string; subtotal: number } — subtotal เป็นสตางค์จากตะกร้าจริง
 * ตรวจเงื่อนไขคูปองทุกข้อจากฐานข้อมูล (ไม่หักเงินจริง ใช้ก่อนกดยืนยัน)
 */
export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user) return jsonError('กรุณาเข้าสู่ระบบ', 401);
  const { code, subtotal } = (await req.json().catch(() => ({}))) as { code?: string; subtotal?: number };
  if (typeof subtotal !== 'number' || subtotal <= 0) {
    return jsonError('ยอดสั่งซื้อไม่ถูกต้อง', 400);
  }
  const result = await checkPromotion(code ?? '', subtotal, DELIVERY_FEE, user.id, null);
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
