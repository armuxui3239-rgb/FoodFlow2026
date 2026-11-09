import crypto from 'crypto';
import { NextRequest } from 'next/server';
import { sbDelete, sbInsert, sbList, sbOne } from '@/lib/supabase';
import { currentUser, jsonError } from '@/lib/api-user';
import { orderCode } from '@/lib/session';
import { promptPayPayload } from '@/lib/promptpay';
import QRCode from 'qrcode';
import { loadCart } from '@/lib/cart-server';

const DELIVERY_FEE = 35;
const FALLBACK_PROMPTPAY = '0812345678';

interface OrderItemRow {
  id: string;
  order_id: string;
  name_snapshot: string;
  quantity: number;
  unit_price: number;
}

export async function GET() {
  const user = await currentUser();
  if (!user) return jsonError('กรุณาเข้าสู่ระบบ', 401);
  const orders = await sbList<Record<string, unknown>>('orders', {
    customer_id: `eq.${user.id}`,
    select: '*,restaurants(name,logo_url)',
    order: 'created_at.desc',
    limit: '50',
  });
  return Response.json({ data: orders });
}

export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user) return jsonError('กรุณาเข้าสู่ระบบ', 401);
  const { addressId, notes = null } = (await req.json().catch(() => ({}))) as {
    addressId?: string | null;
    notes?: string | null;
  };
  // ถ้าไม่ส่งที่อยู่มา ใช้ที่อยู่ตั้งต้นของลูกค้า
  let finalAddressId = addressId ?? null;
  if (!finalAddressId) {
    const defaultAddr = await sbOne<{ id: string }>('addresses', {
      user_id: `eq.${user.id}`,
      select: 'id',
      is_default: 'eq.true',
      order: 'created_at.desc',
      limit: '1',
    });
    finalAddressId = defaultAddr?.id ?? null;
  }
  if (!finalAddressId) return jsonError('กรุณาเพิ่มที่อยู่จัดส่งก่อนสั่งซื้อ', 400);
  const { cart, items, restaurant } = await loadCart(user.id);
  if (!cart || !cart.restaurant_id || items.length === 0) {
    return jsonError('ตะกร้าว่าง กรุณาเลือกเมนูก่อนสั่งซื้อ', 400);
  }
  const subtotal = items.reduce((s, i) => s + i.unit_price * i.quantity, 0);
  const minOrder = Number((restaurant as { minimum?: number } | null)?.minimum ?? 0);
  if (subtotal < minOrder) {
    return jsonError(`ยอดสั่งซื้อขั้นต่ำ ${minOrder} บาท`, 400);
  }
  const total = subtotal + DELIVERY_FEE;
  const fullRestaurant = await sbOne<{ phone: string | null }>('restaurants', {
    id: `eq.${cart.restaurant_id}`,
    select: 'phone',
  });
  const promptPayTarget =
    fullRestaurant?.phone && fullRestaurant.phone.replace(/\D/g, '').length >= 9
      ? fullRestaurant.phone
      : FALLBACK_PROMPTPAY;

  const [order] = await sbInsert<{
    id: string;
    order_code: string;
    status: string;
    subtotal: number;
    delivery_fee: number;
    total: number;
  }>('orders', {
    order_code: orderCode(),
    customer_id: user.id,
    restaurant_id: cart.restaurant_id,
    delivery_address_id: finalAddressId,
    status: 'pending_payment',
    subtotal,
    delivery_fee: DELIVERY_FEE,
    promotion_discount: 0,
    total,
    payment_method: 'promptpay',
    notes,
  });
  await sbInsert('order_items',
    items.map((i) => ({
      order_id: order.id,
      menu_item_id: i.menu_item_id,
      name_snapshot: i.menu_items?.name ?? 'รายการอาหาร',
      quantity: i.quantity,
      unit_price: i.unit_price,
      notes: i.notes,
    })),
  );
  await sbInsert('payments', {
    order_id: order.id,
    amount: total,
    method: 'promptpay',
    status: 'pending',
    transaction_id: `TXN-${crypto.randomUUID().slice(0, 12).toUpperCase()}`,
  });
  await sbDelete('cart_items', { cart_id: `eq.${cart.id}` });
  await sbDelete('carts', { id: `eq.${cart.id}` });

  const payload = promptPayPayload(promptPayTarget, total);
  const qrImage = await QRCode.toDataURL(payload, { width: 320, margin: 1 });
  return Response.json({ order, qrImage, payload }, { status: 201 });
}
