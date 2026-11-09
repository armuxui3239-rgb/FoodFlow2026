import { sbList, sbOne } from '@/lib/supabase';
import { jsonError } from '@/lib/api-user';

interface CategoryRow {
  id: string;
  restaurant_id: string;
  name: string;
  sort_order: number | null;
}

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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await ctx.params;
  // รองรับทั้ง UUID และ slug (เช่น ft-1) — ค้นหาจาก slug เมื่อไม่ใช่ UUID
  let restaurant: Record<string, unknown> | null = null;
  let id = rawId;
  if (UUID_RE.test(rawId)) {
    restaurant = await sbOne<Record<string, unknown>>('restaurants', {
      id: `eq.${rawId}`,
      select: '*',
    });
  } else {
    restaurant = await sbOne<Record<string, unknown>>('restaurants', {
      slug: `eq.${rawId}`,
      select: '*',
    });
    id = String(restaurant?.id ?? rawId);
  }
  if (!restaurant) return jsonError('ไม่พบร้านอาหาร', 404);
  const categories = await sbList<CategoryRow>('categories', {
    restaurant_id: `eq.${id}`,
    select: 'id,restaurant_id,name,sort_order',
    order: 'sort_order.asc.nullslast',
  });
  const items = await sbList<ItemRow>('menu_items', {
    restaurant_id: `eq.${id}`,
    select: 'id,category_id,name,description,image_url,base_price,is_available,is_popular',
    order: 'sort_order.asc.nullslast',
  });
  return Response.json({ restaurant, categories, items });
}
