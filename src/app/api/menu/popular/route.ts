import { sbList } from '@/lib/supabase';

export interface PopularItem {
  id: string;
  name: string;
  image_url: string | null;
  base_price: number;
  restaurant_id: string;
  restaurant_name: string;
}

/**
 * เมนูยอดนิยมจากทุกร้าน — สำหรับส่วน "แนะนำสำหรับคุณ" บนหน้าแรก
 * (join เอง 2 ขั้น เพื่อเลี่ยงปัญหา embed naming ของ PostgREST)
 */
export async function GET() {
  const items = await sbList<{
    id: string;
    name: string;
    image_url: string | null;
    base_price: number;
    restaurant_id: string;
  }>('menu_items', {
    select: 'id,name,image_url,base_price,restaurant_id',
    is_available: 'eq.true',
    is_popular: 'eq.true',
    limit: '12',
  });

  const ids = [...new Set(items.map((i) => i.restaurant_id))].filter(Boolean);
  let nameById = new Map<string, string>();
  if (ids.length > 0) {
    const rests = await sbList<{ id: string; name: string }>('restaurants', {
      select: 'id,name',
      id: `in.(${ids.join(',')})`,
    });
    nameById = new Map(rests.map((r) => [r.id, r.name]));
  }

  const data: PopularItem[] = items.map((i) => ({
    id: i.id,
    name: i.name,
    image_url: i.image_url,
    base_price: i.base_price,
    restaurant_id: i.restaurant_id,
    restaurant_name: nameById.get(i.restaurant_id) ?? 'ฟู๊ด ธันเดอร์',
  }));

  return Response.json({ data });
}
