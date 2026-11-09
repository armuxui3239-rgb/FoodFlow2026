import 'server-only';
import { sbInsert, sbList, sbOne, sbUpdate } from '@/lib/supabase';

/**
 * ระบบคูปอง/โปรโมชั่น (ใช้ร่วมกันโดย /api/orders และ /api/promotions/validate)
 * มาตรฐานหน่วยเงิน: สตางค์ทั้งหมด (subtotal, min_order_amount, max_discount, discount)
 */

export interface PromotionRow {
  id: string;
  code: string;
  type: string;
  value: number | null;
  min_order_amount: number | null;
  max_discount: number | null;
  usage_limit: number | null;
  usage_count: number | null;
  current_usage_count: number | null;
  max_per_user: number | null;
  first_order_only: boolean | null;
  starts_at: string | null;
  expires_at: string | null;
  is_active: boolean | null;
  status: string | null;
  restaurant_id: string | null;
  name: string | null;
}

export type PromotionCheck =
  | { ok: true; promotion: PromotionRow; discount: number; message: string }
  | { ok: false; error: string };

export function findPromotion(code: string): Promise<PromotionRow | null> {
  return sbOne<PromotionRow>('promotions', { code: `eq.${code.trim().toUpperCase()}`, select: '*' });
}

async function usageCountOfUser(promotionId: string, userId: string): Promise<number> {
  const rows = await sbList<{ id: string }>('promotion_usages', {
    promotion_id: `eq.${promotionId}`,
    user_id: `eq.${userId}`,
    select: 'id',
  });
  return rows.length;
}

/** คำนวณส่วนลด (สตางค์) ตามประเภทคูปอง */
export function calcDiscount(p: PromotionRow, subtotalSatang: number, deliveryFeeSatang: number): number {
  let d = 0;
  if (p.type === 'percentage' || p.type === 'percent') {
    d = Math.floor((subtotalSatang * (p.value ?? 0)) / 100);
  } else if (p.type === 'fixed') {
    d = p.value ?? 0;
  } else if (p.type === 'free_shipping') {
    d = deliveryFeeSatang;
  }
  if (p.max_discount != null && p.max_discount > 0) d = Math.min(d, p.max_discount);
  return Math.max(0, Math.min(d, subtotalSatang + deliveryFeeSatang));
}

/** ตรวจคูปองทุกเงื่อนไขจริง แล้วคืนส่วนลด (สตางค์) — ทุกเงื่อนไขตรวจจากฐานข้อมูล ไม่มีค่า hard-code */
export async function checkPromotion(
  code: string,
  subtotalSatang: number,
  deliveryFeeSatang: number,
  userId: string | null,
  restaurantId: string | null,
): Promise<PromotionCheck> {
  const trimmed = (code ?? '').trim().toUpperCase();
  if (!trimmed) return { ok: false, error: 'กรุณากรอกรหัสคูปอง' };

  const p = await findPromotion(trimmed);
  if (!p) return { ok: false, error: 'ไม่พบรหัสคูปองนี้ในระบบ' };
  if (p.is_active !== true || p.status !== 'active') return { ok: false, error: 'คูปองนี้ถูกปิดใช้งาน' };

  const now = Date.now();
  if (p.starts_at && new Date(p.starts_at).getTime() > now) {
    return { ok: false, error: 'คูปองนี้ยังไม่เริ่มใช้งาน' };
  }
  if (p.expires_at && new Date(p.expires_at).getTime() < now) {
    return { ok: false, error: 'คูปองนี้หมดอายุแล้ว' };
  }
  if (p.restaurant_id && restaurantId && p.restaurant_id !== restaurantId) {
    return { ok: false, error: 'คูปองนี้ใช้ได้เฉพาะบางร้าน' };
  }
  const minOrder = p.min_order_amount ?? 0;
  if (minOrder > 0 && subtotalSatang < minOrder) {
    return { ok: false, error: `ยอดสั่งซื้อต้องถึง ${(minOrder / 100).toLocaleString('th-TH')} บาทจึงใช้คูปองนี้ได้` };
  }
  if (p.usage_limit != null && (p.usage_count ?? 0) >= p.usage_limit) {
    return { ok: false, error: 'คูปองนี้ถูกใช้ครบจำนวนแล้ว' };
  }
  if (userId) {
    const used = await usageCountOfUser(p.id, userId);
    if (p.first_order_only && used >= 1) return { ok: false, error: 'คูปองนี้สำหรับออเดอร์แรกเท่านั้น' };
    if (p.max_per_user != null && p.max_per_user > 0 && used >= p.max_per_user) {
      return { ok: false, error: 'คุณใช้คูปองนี้ครบจำนวนที่กำหนดแล้ว' };
    }
  }

  const discount = calcDiscount(p, subtotalSatang, deliveryFeeSatang);
  if (discount <= 0) return { ok: false, error: 'คูปองนี้ไม่ให้ส่วนลดกับยอดนี้' };

  return {
    ok: true,
    promotion: p,
    discount,
    message: p.type === 'free_shipping' ? 'ฟรีค่าจัดส่งแล้ว' : `ใช้คูปอง ${p.code} สำเร็จ`,
  };
}

/** บันทึกการใช้คูปอง + อัปเดตตัวนับการใช้งานของโปรโมชั่น */
export async function recordPromotionUsage(
  promotion: PromotionRow,
  userId: string,
  orderId: string,
  discountSatang: number,
): Promise<void> {
  await sbInsert('promotion_usages', {
    promotion_id: promotion.id,
    user_id: userId,
    order_id: orderId,
    discount_amount: discountSatang,
    used_at: new Date().toISOString(),
  });
  await sbUpdate('promotions', { id: `eq.${promotion.id}` }, {
    usage_count: (promotion.usage_count ?? 0) + 1,
    current_usage_count: (promotion.current_usage_count ?? 0) + 1,
    updated_at: new Date().toISOString(),
  });
}
