import { NextRequest } from 'next/server';
import { requireRole, getOwnerRestaurant } from '@/lib/portal';
import { sbOne, sbList, sbUpdate, sbDelete } from '@/lib/supabase';
import { jsonError } from '@/lib/api-user';

/** ต้องเป็นคูปองของร้านฉันเท่านั้น — ตรวจก่อนทุกเมธอด */
async function myPromo(restaurantId: string, id: string) {
  return sbOne<{ id: string }>('promotions', {
    id: `eq.${id}`,
    restaurant_id: `eq.${restaurantId}`,
    select: 'id',
  });
}

/** GET /api/owner/promotions/[id] — รายละเอียดคูปอง + สถิติการใช้งาน */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await requireRole('restaurant');
  if (!user) return jsonError('เฉพาะเจ้าของร้านเท่านั้น', 403);
  const owner = await getOwnerRestaurant(user.id);
  if (!owner) return jsonError('บัญชีนี้ยังไม่ผูกกับร้านอาหาร', 404);

  const { id } = await ctx.params;
  const promo = await sbOne<Record<string, unknown>>('promotions', {
    id: `eq.${id}`,
    restaurant_id: `eq.${owner.restaurantId}`,
    select: '*',
  });
  if (!promo) return jsonError('ไม่พบคูปองของร้านคุณ', 404);

  const usages = await sbList<{ discount_amount: number }>('promotion_usages', {
    promotion_id: `eq.${id}`,
    select: 'discount_amount',
    limit: '1000',
  });
  const totalDiscount = usages.reduce((s, u) => s + Number(u.discount_amount), 0);
  return Response.json({ promotion: promo, usageCount: usages.length, totalDiscountSatang: totalDiscount });
}

/**
 * PATCH /api/owner/promotions/[id] — แก้ไขคูปอง / เปิด-ปิดใช้งาน
 * { name?, value?, minOrderBaht?, maxDiscountBaht?, usageLimit?, maxPerUser?, firstOrderOnly?, expiresAt?, isActive? }
 */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await requireRole('restaurant');
  if (!user) return jsonError('เฉพาะเจ้าของร้านเท่านั้น', 403);
  const owner = await getOwnerRestaurant(user.id);
  if (!owner) return jsonError('บัญชีนี้ยังไม่ผูกกับร้านอาหาร', 404);

  const { id } = await ctx.params;
  if (!(await myPromo(owner.restaurantId, id))) return jsonError('ไม่พบคูปองของร้านคุณ', 404);

  const b = (await req.json().catch(() => ({}))) as {
    name?: string;
    value?: number;
    minOrderBaht?: number;
    maxDiscountBaht?: number | null;
    usageLimit?: number;
    maxPerUser?: number | null;
    firstOrderOnly?: boolean;
    expiresAt?: string | null;
    isActive?: boolean;
  };

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof b.name === 'string' && b.name.trim()) patch.name = b.name.trim();
  if (typeof b.value === 'number' && Number.isFinite(b.value) && b.value > 0) patch.value = b.value;
  if (typeof b.minOrderBaht === 'number') patch.min_order_amount = Math.round(b.minOrderBaht * 100);
  if (b.maxDiscountBaht !== undefined) {
    patch.max_discount = b.maxDiscountBaht ? Math.round(b.maxDiscountBaht * 100) : null;
  }
  if (typeof b.usageLimit === 'number' && b.usageLimit > 0) patch.usage_limit = Math.round(b.usageLimit);
  if (b.maxPerUser !== undefined) {
    patch.max_per_user = typeof b.maxPerUser === 'number' && b.maxPerUser > 0 ? Math.round(b.maxPerUser) : null;
  }
  if (typeof b.firstOrderOnly === 'boolean') patch.first_order_only = b.firstOrderOnly;
  if (b.expiresAt !== undefined && b.expiresAt) patch.expires_at = `${b.expiresAt}T23:59:59+07:00`;
  if (typeof b.isActive === 'boolean') {
    patch.is_active = b.isActive;
    // รูปแบบเดียวกับระบบกลาง: ใช้ is_active เป็นตัวสลับ และคง status='active' ตาม fork pattern
    if (b.isActive) patch.status = 'active';
  }

  const [updated] = await sbUpdate<{ id: string; is_active: boolean }>('promotions', { id: `eq.${id}` }, patch);
  if (!updated) return jsonError('แก้ไขคูปองไม่สำเร็จ', 500);
  return Response.json({ ok: true, isActive: updated.is_active });
}

/** DELETE /api/owner/promotions/[id] — ลบคูปอง (ถ้ามีประวัติการใช้งานจะลบไม่ได้) */
export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await requireRole('restaurant');
  if (!user) return jsonError('เฉพาะเจ้าของร้านเท่านั้น', 403);
  const owner = await getOwnerRestaurant(user.id);
  if (!owner) return jsonError('บัญชีนี้ยังไม่ผูกกับร้านอาหาร', 404);

  const { id } = await ctx.params;
  if (!(await myPromo(owner.restaurantId, id))) return jsonError('ไม่พบคูปองของร้านคุณ', 404);

  try {
    await sbDelete('promotions', { id: `eq.${id}`, restaurant_id: `eq.${owner.restaurantId}` });
  } catch {
    return jsonError('ลบคูปองไม่สำเร็จ — มีประวัติการใช้งานผูกอยู่ แนะนำให้ปิดใช้งานแทน', 409);
  }
  return Response.json({ ok: true });
}
