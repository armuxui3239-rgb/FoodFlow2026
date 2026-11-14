import { NextRequest } from 'next/server';
import { requireRole, getOwnerRestaurant } from '@/lib/portal';
import { sbList, sbInsert } from '@/lib/supabase';
import { jsonError } from '@/lib/api-user';

interface CategoryRow {
  id: string;
  name: string;
  sort_order: number;
  is_visible: boolean;
}

/** GET /api/owner/categories — หมวดหมู่ทั้งหมดของร้านฉัน (เรียงตาม sort_order) */
export async function GET(_req: NextRequest) {
  const user = await requireRole('restaurant');
  if (!user) return jsonError('เฉพาะเจ้าของร้านเท่านั้น', 403);
  const owner = await getOwnerRestaurant(user.id);
  if (!owner) return jsonError('บัญชีนี้ยังไม่ผูกกับร้านอาหาร', 404);

  const categories = await sbList<CategoryRow>('categories', {
    restaurant_id: `eq.${owner.restaurantId}`,
    select: 'id,name,sort_order,is_visible',
    order: 'sort_order.asc.nullslast',
    limit: '100',
  });
  return Response.json({ data: categories });
}

/** POST /api/owner/categories — เพิ่มหมวดหมู่ใหม่ { name, sortOrder?, isVisible? } */
export async function POST(req: NextRequest) {
  const user = await requireRole('restaurant');
  if (!user) return jsonError('เฉพาะเจ้าของร้านเท่านั้น', 403);
  const owner = await getOwnerRestaurant(user.id);
  if (!owner) return jsonError('บัญชีนี้ยังไม่ผูกกับร้านอาหาร', 404);

  const b = (await req.json().catch(() => ({}))) as {
    name?: string;
    sortOrder?: number;
    isVisible?: boolean;
  };
  const name = b.name?.trim();
  if (!name) return jsonError('กรุณาระบุชื่อหมวดหมู่', 400);

  // ตาราง categories บังคับ sort_order/is_visible/updated_at — เติมค่าเริ่มต้นให้ครบ
  const [created] = await sbInsert<CategoryRow>('categories', {
    restaurant_id: owner.restaurantId,
    name,
    sort_order: typeof b.sortOrder === 'number' ? Math.round(b.sortOrder) : 0,
    is_visible: b.isVisible ?? true,
    icon: null,
    parent_id: null,
    updated_at: new Date().toISOString(),
  });
  return Response.json({ ok: true, category: created }, { status: 201 });
}
