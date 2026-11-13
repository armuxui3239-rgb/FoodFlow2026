import { NextRequest } from 'next/server';
import { sbDelete, sbInsert, sbList, sbOne, sbUpdate } from '@/lib/supabase';
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
  const { menuItemId, quantity = 1, notes, optionValueIds } = (await req.json()) as {
    menuItemId?: string;
    quantity?: number;
    notes?: string;
    optionValueIds?: string[];
  };
  if (!menuItemId) return jsonError('ไม่พบรายการอาหาร', 400);
  const qty = Math.min(Math.max(Math.trunc(Number(quantity)) || 1, 1), 20);
  const item = await sbOne<{ id: string; restaurant_id: string; base_price: number; is_available: boolean }>(
    'menu_items',
    { id: `eq.${menuItemId}`, select: 'id,restaurant_id,base_price,is_available' },
  );
  if (!item || !item.is_available) return jsonError('เมนูนี้ไม่พร้อมขาย', 400);

  // ---- ตรวจตัวเลือกเสริมฝั่ง server (ราคาคิดจาก DB เสมอ ห้ามเชื่อ client) ----
  let unitPrice = Number(item.base_price);
  let selectedOptions: { name: string; value: string; priceModifier: number }[] = [];
  const reqIds = Array.isArray(optionValueIds) ? [...new Set(optionValueIds)].slice(0, 20) : [];
  if (reqIds.length > 0) {
    const groups = await sbList<{ id: string; name: string; is_required: boolean; is_multiple: boolean }>(
      'menu_item_options',
      { menu_item_id: `eq.${menuItemId}`, select: 'id,name,is_required,is_multiple' },
    );
    const groupById = new Map(groups.map((g) => [g.id, g]));
    const values = await sbList<{
      id: string;
      option_id: string;
      value: string;
      price_modifier: number;
    }>('menu_item_option_values', {
      option_id: `in.(${groups.map((g) => g.id).join(',')})`,
      select: 'id,option_id,value,price_modifier',
    });
    const valueById = new Map(values.map((v) => [v.id, v]));

    const picksPerOption = new Map<string, typeof values>();
    for (const vid of reqIds) {
      const v = valueById.get(vid);
      if (!v) return jsonError('มีตัวเลือกที่ไม่ตรงกับเมนูนี้', 400);
      const list = picksPerOption.get(v.option_id) ?? [];
      list.push(v);
      picksPerOption.set(v.option_id, list);
    }
    for (const g of groups) {
      const picks = picksPerOption.get(g.id) ?? [];
      if (g.is_required && picks.length === 0) return jsonError(`กรุณาเลือก "${g.name}" ก่อนเพิ่มลงตะกร้า`, 400);
      if (!g.is_multiple && picks.length > 1) return jsonError(`"${g.name}" เลือกได้ 1 รายการ`, 400);
      for (const v of picks) {
        unitPrice += Number(v.price_modifier);
        selectedOptions.push({ name: g.name, value: v.value, priceModifier: Number(v.price_modifier) });
      }
    }
  }

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
  // รวมจำนวนเฉพาะรายการที่ "ตัวเลือก + หมายเหตุ เหมือนกันเป๊ะ" — ต่างตัวเลือก = แถวใหม่
  const noteValue = (notes ?? '').trim() || null;
  const siblings = await sbList<CartItemRow>('cart_items', {
    cart_id: `eq.${cart.id}`,
    menu_item_id: `eq.${menuItemId}`,
    select: 'id,quantity,notes,selected_options',
  });
  const sameOptions = (stored: unknown) =>
    JSON.stringify(Array.isArray(stored) ? stored : []) === JSON.stringify(selectedOptions);
  const existing = siblings.find((s) => sameOptions(s.selected_options) && (s.notes ?? null) === noteValue);
  if (existing) {
    await sbUpdate('cart_items', { id: `eq.${existing.id}` }, { quantity: existing.quantity + qty });
  } else {
    await sbInsert('cart_items', {
      cart_id: cart.id,
      menu_item_id: menuItemId,
      quantity: qty,
      unit_price: unitPrice,
      selected_options: selectedOptions,
      notes: noteValue,
    });
  }
  return Response.json(await loadCart(user.id));
}
