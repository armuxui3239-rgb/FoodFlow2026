import 'server-only';
import { sbDelete, sbInsert, sbList, sbOne, sbUpdate } from '@/lib/supabase';

interface CartRow {
  id: string;
  user_id: string;
  restaurant_id: string | null;
}

interface CartItemRow {
  id: string;
  cart_id: string;
  menu_item_id: string;
  quantity: number;
  unit_price: number;
  notes: string | null;
  menu_items: { name: string; image_url: string | null; base_price: number } | null;
}

export async function getOrCreateCart(userId: string): Promise<CartRow> {
  let cart = await sbOne<CartRow>('carts', {
    user_id: `eq.${userId}`,
    select: 'id,user_id,restaurant_id',
    order: 'created_at.desc',
    limit: '1',
  });
  if (!cart) {
    cart = (await sbInsert<CartRow>('carts', { user_id: userId }))[0];
  }
  return cart;
}

export async function loadCart(userId: string) {
  const cart = await sbOne<CartRow>('carts', {
    user_id: `eq.${userId}`,
    select: 'id,user_id,restaurant_id',
    order: 'created_at.desc',
    limit: '1',
  });
  if (!cart || !cart.restaurant_id) return { cart: null, items: [], restaurant: null };
  const items = await sbList<CartItemRow>('cart_items', {
    cart_id: `eq.${cart.id}`,
    select: 'id,cart_id,menu_item_id,quantity,unit_price,notes,menu_items(name,image_url,base_price)',
  });
  const restaurant = await sbOne<Record<string, unknown>>('restaurants', {
    id: `eq.${cart.restaurant_id}`,
    select: 'id,name,logo_url,minimum:min_order_amount,prep:prep_time_avg_minutes,rating,is_open',
  });
  return { cart, items, restaurant };
}

export { type CartRow, type CartItemRow };
