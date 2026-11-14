import { NextRequest } from 'next/server';
import { requireRole, getOwnerRestaurant } from '@/lib/portal';
import { sbList, sbOne, sbUpdate, sbInsert } from '@/lib/supabase';
import { jsonError } from '@/lib/api-user';

interface ItemRow {
  id: string;
  category_id: string | null;
  name: string;
  description: string | null;
  image_url: string | null;
  base_price: number;
  is_available: boolean;
  is_popular: boolean;
}

/** GET /api/owner/menu — เมนูทั้งหมดของร้านฉัน แยกตามหมวด */
export async function GET(_req: NextRequest) {
  const user = await requireRole('restaurant');
  if (!user) return jsonError('เฉพาะเจ้าของร้านเท่านั้น', 403);
  const owner = await getOwnerRestaurant(user.id);
  if (!owner) return jsonError('บัญชีนี้ยังไม่ผูกกับร้านอาหาร', 404);

  const categories = await sbList<{ id: string; name: string; sort_order: number | null }>('categories', {
    restaurant_id: `eq.${owner.restaurantId}`,
    select: 'id,name,sort_order',
    order: 'sort_order.asc.nullslast',
    limit: '50',
  });
  const items = await sbList<ItemRow>('menu_items', {
    restaurant_id: `eq.${owner.restaurantId}`,
    select: 'id,category_id,name,description,image_url,base_price,is_available,is_popular',
    order: 'sort_order.asc.nullslast',
    limit: '500',
  });
  return Response.json({
    restaurant: { id: owner.restaurantId, name: owner.restaurantName },
    categories,
    items,
  });
}

/** PATCH /api/owner/menu — เปิด/ปิดขายเมนู { itemId, isAvailable } */
export async function PATCH(req: NextRequest) {
  const user = await requireRole('restaurant');
  if (!user) return jsonError('เฉพาะเจ้าของร้านเท่านั้น', 403);
  const owner = await getOwnerRestaurant(user.id);
  if (!owner) return jsonError('บัญชีนี้ยังไม่ผูกกับร้านอาหาร', 404);

  const { itemId, isAvailable } = (await req.json().catch(() => ({}))) as {
    itemId?: string;
    isAvailable?: boolean;
  };
  if (!itemId || typeof isAvailable !== 'boolean') {
    return jsonError('กรุณาระบุ itemId และ isAvailable', 400);
  }
  // เมนูต้องเป็นของร้านฉัน
  const item = await sbOne<{ id: string }>('menu_items', {
    id: `eq.${itemId}`,
    restaurant_id: `eq.${owner.restaurantId}`,
    select: 'id',
  });
  if (!item) return jsonError('ไม่พบเมนูของร้านคุณ', 404);

  const [updated] = await sbUpdate<{ id: string; is_available: boolean }>(
    'menu_items',
    { id: `eq.${itemId}` },
    { is_available: isAvailable },
  );
  return Response.json({ ok: true, item: updated });
}

/**
 * POST /api/owner/menu — เพิ่มเมนูใหม่
 * { name, description?, imageUrl?, basePriceBaht, categoryId, isAvailable?, isPopular?, sortOrder? }
 * ราคารับเป็นบาทจากฟอร์ม แล้วเก็บเป็นสตางค์ (จำนวนเต็ม) ตามมาตรฐานฐานข้อมูล
 */
export async function POST(req: NextRequest) {
  const user = await requireRole('restaurant');
  if (!user) return jsonError('เฉพาะเจ้าของร้านเท่านั้น', 403);
  const owner = await getOwnerRestaurant(user.id);
  if (!owner) return jsonError('บัญชีนี้ยังไม่ผูกกับร้านอาหาร', 404);

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
  const name = b.name?.trim();
  if (!name) return jsonError('กรุณาระบุชื่อเมนู', 400);
  if (typeof b.basePriceBaht !== 'number' || !Number.isFinite(b.basePriceBaht) || b.basePriceBaht < 0) {
    return jsonError('กรุณาระบุราคาให้ถูกต้อง', 400);
  }
  if (!b.categoryId) return jsonError('กรุณาเลือกหมวดหมู่', 400);

  // หมวดหมู่ต้องเป็นของร้านฉันเท่านั้น
  const cat = await sbOne<{ id: string }>('categories', {
    id: `eq.${b.categoryId}`,
    restaurant_id: `eq.${owner.restaurantId}`,
    select: 'id',
  });
  if (!cat) return jsonError('ไม่พบหมวดหมู่ของร้านคุณ', 404);

  const now = new Date().toISOString();
  const [created] = await sbInsert<{ id: string; name: string }>('menu_items', {
    restaurant_id: owner.restaurantId,
    category_id: b.categoryId,
    name,
    description: b.description?.trim() || null,
    image_url: b.imageUrl?.trim() || null,
    base_price: Math.round(b.basePriceBaht * 100),
    is_available: b.isAvailable ?? true,
    is_popular: b.isPopular ?? false,
    sort_order: typeof b.sortOrder === 'number' ? Math.round(b.sortOrder) : 0,
    created_at: now,
    updated_at: now,
  });
  return Response.json({ ok: true, item: created }, { status: 201 });
}
