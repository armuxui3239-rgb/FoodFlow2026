import { NextRequest } from 'next/server';
import { requireRole, getOwnerRestaurant } from '@/lib/portal';
import { sbOne, sbList, sbUpdate, sbDelete } from '@/lib/supabase';
import { jsonError } from '@/lib/api-user';

/**
 * PATCH /api/owner/categories/[id] — แก้ไขหมวดหมู่ของร้านฉัน
 * { name?, sortOrder?, isVisible? }
 */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await requireRole('restaurant');
  if (!user) return jsonError('เฉพาะเจ้าของร้านเท่านั้น', 403);
  const owner = await getOwnerRestaurant(user.id);
  if (!owner) return jsonError('บัญชีนี้ยังไม่ผูกกับร้านอาหาร', 404);

  const { id } = await ctx.params;
  const cat = await sbOne<{ id: string }>('categories', {
    id: `eq.${id}`,
    restaurant_id: `eq.${owner.restaurantId}`,
    select: 'id',
  });
  if (!cat) return jsonError('ไม่พบหมวดหมู่ของร้านคุณ', 404);

  const b = (await req.json().catch(() => ({}))) as {
    name?: string;
    sortOrder?: number;
    isVisible?: boolean;
  };
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof b.name === 'string' && b.name.trim()) patch.name = b.name.trim();
  if (typeof b.sortOrder === 'number') patch.sort_order = Math.round(b.sortOrder);
  if (typeof b.isVisible === 'boolean') patch.is_visible = b.isVisible;

  const [updated] = await sbUpdate<{ id: string }>('categories', { id: `eq.${id}` }, patch);
  return Response.json({ ok: true, category: updated });
}

/** DELETE /api/owner/categories/[id] — ลบหมวดหมู่ (ห้ามลบถ้ายังมีเมนูใช้อยู่) */
export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await requireRole('restaurant');
  if (!user) return jsonError('เฉพาะเจ้าของร้านเท่านั้น', 403);
  const owner = await getOwnerRestaurant(user.id);
  if (!owner) return jsonError('บัญชีนี้ยังไม่ผูกกับร้านอาหาร', 404);

  const { id } = await ctx.params;
  const cat = await sbOne<{ id: string }>('categories', {
    id: `eq.${id}`,
    restaurant_id: `eq.${owner.restaurantId}`,
    select: 'id',
  });
  if (!cat) return jsonError('ไม่พบหมวดหมู่ของร้านคุณ', 404);

  const used = await sbList<{ id: string }>('menu_items', {
    category_id: `eq.${id}`,
    select: 'id',
    limit: '1',
  });
  if (used.length > 0) {
    return jsonError('ลบไม่ได้ — ยังมีเมนูอยู่ในหมวดหมู่นี้ กรุณาย้ายหรือลบเมนูก่อน', 409);
  }

  try {
    await sbDelete('categories', { id: `eq.${id}`, restaurant_id: `eq.${owner.restaurantId}` });
  } catch {
    return jsonError('ลบหมวดหมู่ไม่สำเร็จ กรุณาลองอีกครั้ง', 500);
  }
  return Response.json({ ok: true });
}
