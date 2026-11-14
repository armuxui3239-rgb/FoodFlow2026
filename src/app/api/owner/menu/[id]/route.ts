import { NextRequest } from 'next/server';
import { requireRole, getOwnerRestaurant } from '@/lib/portal';
import { sbOne, sbUpdate, sbDelete } from '@/lib/supabase';
import { jsonError } from '@/lib/api-user';

/**
 * PATCH /api/owner/menu/[id] — แก้ไขเมนูของร้านฉัน
 * { name?, description?, imageUrl?, basePriceBaht?, categoryId?, isAvailable?, isPopular?, sortOrder? }
 */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await requireRole('restaurant');
  if (!user) return jsonError('เฉพาะเจ้าของร้านเท่านั้น', 403);
  const owner = await getOwnerRestaurant(user.id);
  if (!owner) return jsonError('บัญชีนี้ยังไม่ผูกกับร้านอาหาร', 404);

  const { id } = await ctx.params;
  const item = await sbOne<{ id: string }>('menu_items', {
    id: `eq.${id}`,
    restaurant_id: `eq.${owner.restaurantId}`,
    select: 'id',
  });
  if (!item) return jsonError('ไม่พบเมนูของร้านคุณ', 404);

  const b = (await req.json().catch(() => ({}))) as {
    name?: string;
    description?: string | null;
    imageUrl?: string | null;
    basePriceBaht?: number;
    categoryId?: string;
    isAvailable?: boolean;
    isPopular?: boolean;
    sortOrder?: number;
  };

  // เปลี่ยนหมวดหมู่ได้เฉพาะหมวดของร้านฉัน
  if (b.categoryId) {
    const cat = await sbOne<{ id: string }>('categories', {
      id: `eq.${b.categoryId}`,
      restaurant_id: `eq.${owner.restaurantId}`,
      select: 'id',
    });
    if (!cat) return jsonError('ไม่พบหมวดหมู่ของร้านคุณ', 404);
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof b.name === 'string' && b.name.trim()) patch.name = b.name.trim();
  if (b.description !== undefined) patch.description = b.description?.trim() || null;
  if (b.imageUrl !== undefined) patch.image_url = b.imageUrl?.trim() || null;
  if (typeof b.basePriceBaht === 'number' && Number.isFinite(b.basePriceBaht) && b.basePriceBaht >= 0) {
    patch.base_price = Math.round(b.basePriceBaht * 100);
  }
  if (b.categoryId) patch.category_id = b.categoryId;
  if (typeof b.isAvailable === 'boolean') patch.is_available = b.isAvailable;
  if (typeof b.isPopular === 'boolean') patch.is_popular = b.isPopular;
  if (typeof b.sortOrder === 'number') patch.sort_order = Math.round(b.sortOrder);

  const [updated] = await sbUpdate<{ id: string }>('menu_items', { id: `eq.${id}` }, patch);
  return Response.json({ ok: true, item: updated });
}

/**
 * DELETE /api/owner/menu/[id] — ลบเมนู (ลบตัวเลือกประกอบก่อน ถ้ายังถูกออเดอร์อ้างถึงจะลบไม่ได้)
 */
export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await requireRole('restaurant');
  if (!user) return jsonError('เฉพาะเจ้าของร้านเท่านั้น', 403);
  const owner = await getOwnerRestaurant(user.id);
  if (!owner) return jsonError('บัญชีนี้ยังไม่ผูกกับร้านอาหาร', 404);

  const { id } = await ctx.params;
  const item = await sbOne<{ id: string }>('menu_items', {
    id: `eq.${id}`,
    restaurant_id: `eq.${owner.restaurantId}`,
    select: 'id',
  });
  if (!item) return jsonError('ไม่พบเมนูของร้านคุณ', 404);

  // ลบตัวเลือกของเมนูก่อน (เป็นของเมนูนี้โดยตรง ปลอดภัยที่จะลบ)
  await sbDelete('menu_item_options', { menu_item_id: `eq.${id}` }).catch(() => undefined);

  try {
    await sbDelete('menu_items', { id: `eq.${id}`, restaurant_id: `eq.${owner.restaurantId}` });
  } catch {
    return jsonError('ลบเมนูไม่สำเร็จ — เมนูนี้ถูกใช้ในออเดอร์หรือตะกร้าอยู่ แนะนำให้ปิดขายแทน', 409);
  }
  return Response.json({ ok: true });
}
