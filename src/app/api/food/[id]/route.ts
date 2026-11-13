import { NextRequest } from 'next/server';
import { sbList, sbOne } from '@/lib/supabase';
import { jsonError } from '@/lib/api-user';

/** GET /api/food/[id] — รายละเอียดเมนู 1 รายการ + กลุ่มตัวเลือกเสริม (สาธารณะ เหมือนหน้าร้าน) */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const item = await sbOne<{
    id: string;
    restaurant_id: string;
    name: string;
    description: string | null;
    image_url: string | null;
    base_price: number;
    is_available: boolean;
    is_popular: boolean;
  }>('menu_items', {
    id: `eq.${id}`,
    select: 'id,restaurant_id,name,description,image_url,base_price,is_available,is_popular',
  });
  if (!item) return jsonError('ไม่พบเมนูนี้', 404);

  const [restaurant] = await sbList<{ id: string; name: string; is_open: boolean }>('restaurants', {
    id: `eq.${item.restaurant_id}`,
    select: 'id,name,is_open',
    limit: '1',
  });

  const groups = await sbList<{
    id: string;
    name: string;
    is_required: boolean;
    is_multiple: boolean;
  }>('menu_item_options', {
    menu_item_id: `eq.${item.id}`,
    select: 'id,name,is_required,is_multiple',
    order: 'created_at.asc.nullslast',
  });

  const groupIds = groups.map((g) => g.id);
  const values = groupIds.length
    ? await sbList<{
        id: string;
        option_id: string;
        value: string;
        price_modifier: number;
      }>('menu_item_option_values', {
        option_id: `in.(${groupIds.join(',')})`,
        select: 'id,option_id,value,price_modifier',
      })
    : [];

  return Response.json({
    item: {
      id: item.id,
      restaurantId: item.restaurant_id,
      name: item.name,
      description: item.description,
      imageUrl: item.image_url,
      basePriceSatang: Number(item.base_price),
      isAvailable: item.is_available,
      isPopular: item.is_popular,
    },
    restaurant: { name: restaurant?.name ?? '-', isOpen: restaurant?.is_open ?? false },
    options: groups.map((g) => ({
      id: g.id,
      name: g.name,
      isRequired: g.is_required,
      isMultiple: g.is_multiple,
      values: values
        .filter((v) => v.option_id === g.id)
        .map((v) => ({ id: v.id, value: v.value, priceModifierSatang: Number(v.price_modifier) })),
    })),
  });
}
