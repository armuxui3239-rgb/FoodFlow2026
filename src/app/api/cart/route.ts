import { NextRequest } from 'next/server';
import { sbDelete, sbInsert, sbOne, sbUpdate } from '@/lib/supabase';
import { currentUser, jsonError } from '@/lib/api-user';
import { getOrCreateCart, loadCart, type CartRow, type CartItemRow } from '@/lib/cart-server';

export async function GET() {
  const user = await currentUser();
  if (!user) return jsonError('กรุณาเข้าสู่ระบบ', 401);
  const data = await loadCart(user.id);
  return Response.json(data);
}

export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user) return jsonError('กรุณาเข้าสู่ระบบ', 401);
  const { menuItemId, quantity = 1, notes } = (await req.json()) as {
    menuItemId?: string;
    quantity?: number;
    notes?: string;
  };
  if (!menuItemId) return jsonError('ไม่พบรายการอาหาร', 400);
  const item = await sbOne<{ id: string; restaurant_id: string; base_price: number; is_available: boolean }>(
    'menu_items',
    { id: `eq.${menuItemId}`, select: 'id,restaurant_id,base_price,is_available' },
  );
  if (!item || !item.is_available) return jsonError('เมนูนี้ไม่พร้อมขาย', 400);
  let cart = await getOrCreateCart(user.id);
  if (cart.restaurant_id && cart.restaurant_id !== item.restaurant_id) {
    // One restaurant per cart: replace previous cart
    await sbDelete('cart_items', { cart_id: `eq.${cart.id}` });
    await sbDelete('carts', { id: `eq.${cart.id}` });
    cart = (await sbInsert<CartRow>('carts', {
      user_id: user.id,
      restaurant_id: item.restaurant_id,
    }))[0];
  } else if (!cart.restaurant_id) {
    cart = (await sbUpdate<CartRow>('carts', { id: `eq.${cart.id}` }, { restaurant_id: item.restaurant_id }))[0];
  }
  const existing = await sbOne<CartItemRow>('cart_items', {
    cart_id: `eq.${cart.id}`,
    menu_item_id: `eq.${menuItemId}`,
    select: 'id,quantity',
  });
  if (existing) {
    await sbUpdate('cart_items', { id: `eq.${existing.id}` }, { quantity: existing.quantity + quantity });
  } else {
    await sbInsert('cart_items', {
      cart_id: cart.id,
      menu_item_id: menuItemId,
      quantity,
      unit_price: item.base_price,
      notes: notes ?? null,
    });
  }
  return Response.json(await loadCart(user.id));
}
