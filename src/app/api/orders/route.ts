import crypto from 'crypto';
import { NextRequest } from 'next/server';
import { sbDelete, sbInsert, sbList, sbOne } from '@/lib/supabase';
import { currentUser, jsonError } from '@/lib/api-user';
import { orderCode } from '@/lib/session';
import { promptPayPayload } from '@/lib/promptpay';
import QRCode from 'qrcode';
import { loadCart } from '@/lib/cart-server';
import { checkPromotion, recordPromotionUsage, type PromotionRow } from '@/lib/promotion';
import { getWalletBalance } from '@/lib/wallet';

const DELIVERY_FEE = 3500; // สตางค์ตามมาตรฐานฐานข้อมูล (฿35)
const FALLBACK_PROMPTPAY = process.env.PROMPTPAY_FALLBACK_TARGET ?? '0812345678';

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
  const { addressId, notes = null, couponCode = null, paymentMethod = 'promptpay' } = (await req.json().catch(() => ({}))) as {
    addressId?: string | null;
    notes?: string | null;
    couponCode?: string | null;
    paymentMethod?: 'wallet' | 'cash' | 'promptpay';
  };
  const pm = paymentMethod === 'wallet' || paymentMethod === 'cash' ? paymentMethod : 'promptpay';
  // ถ้าไม่ส่งที่อยู่มา ใช้ที่อยู่ตั้งต้นของลูกค้า; ถ้าส่งมา ต้องตรวจว่าเป็นของลูกค้ารายนี้จริง
  let finalAddressId: string | null = null;
  if (addressId) {
    const ownedAddr = await sbOne<{ id: string }>('addresses', {
      id: `eq.${addressId}`,
      user_id: `eq.${user.id}`,
      select: 'id',
    });
    if (!ownedAddr) return jsonError('ไม่พบที่อยู่จัดส่งนี้ในบัญชีของคุณ', 404);
    finalAddressId = ownedAddr.id;
  } else {
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
  const subtotal = items.reduce((s, i) => s + i.unit_price * i.quantity, 0); // สตางค์
  const minOrder = Number((restaurant as { minimum?: number } | null)?.minimum ?? 0);
  if (minOrder > 0 && subtotal < minOrder) {
    return jsonError(`ยอดสั่งซื้อขั้นต่ำ ${minOrder / 100} บาท`, 400);
  }

  // ---- คูปอง: ตรวจเงื่อนไขจริงจากฐานข้อมูลทุกข้อ ก่อนหักเงิน ----
  let promotionDiscount = 0;
  let appliedPromotion: PromotionRow | null = null;
  if (couponCode && couponCode.trim() !== '') {
    const check = await checkPromotion(couponCode, subtotal, DELIVERY_FEE, user.id, cart.restaurant_id);
    if (!check.ok) return jsonError(check.error, 400);
    promotionDiscount = check.discount;
    appliedPromotion = check.promotion;
  }

  const total = subtotal + DELIVERY_FEE - promotionDiscount;

  // ---- กระเป๋าเงิน: ตรวจยอดรวมทั้งหมดที่ completed ----
  if (pm === 'wallet') {
    const walletBalance = await getWalletBalance(user.id);
    if (total > walletBalance) {
      return jsonError(
        `ยอดเงินในกระเป๋าไม่พอ (คงเหลือ ${(walletBalance / 100).toLocaleString('th-TH', { maximumFractionDigits: 2 })} บาท)`,
        400,
      );
    }
  }

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
    promotion_discount: number;
    total: number;
  }>('orders', {
    order_code: orderCode(),
    customer_id: user.id,
    restaurant_id: cart.restaurant_id,
    delivery_address_id: finalAddressId,
    // wallet = หักเงินทันที -> paid · cash = เงินสดปลายทาง ร้านเริ่มทำได้เลย (payments ยัง pending) · promptpay = รอชำระ
    status: pm === 'wallet' ? 'paid' : pm === 'cash' ? 'restaurant_pending' : 'pending_payment',
    subtotal,
    delivery_fee: DELIVERY_FEE,
    promotion_discount: promotionDiscount,
    total,
    payment_method: pm,
    notes,
  });
  await sbInsert('order_items',
    items.map((i) => ({
      order_id: order.id,
      menu_item_id: i.menu_item_id,
      name_snapshot: i.menu_items?.name ?? 'รายการอาหาร',
      quantity: i.quantity,
      unit_price: i.unit_price,
      selected_options: i.selected_options ?? [],
      notes: i.notes,
    })),
  );
  await sbInsert('payments', {
    order_id: order.id,
    amount: total,
    method: pm,
    status: pm === 'wallet' ? 'completed' : 'pending',
    paid_at: pm === 'wallet' ? new Date().toISOString() : null,
    transaction_id: `TXN-${crypto.randomUUID().slice(0, 12).toUpperCase()}`,
  });
  if (pm === 'wallet') {
    await sbInsert('wallet_transactions', {
      user_id: user.id,
      amount_delta: -total, // สตางค์ติดลบ = หักเงินออกจากกระเป๋า
      type: 'debit',
      status: 'completed',
      reason: `ชำระค่าอาหาร ${order.order_code}`,
      ref_id: order.id,
    });
  }
  if (appliedPromotion) {
    await recordPromotionUsage(appliedPromotion, user.id, order.id, promotionDiscount);
  }
  await sbDelete('cart_items', { cart_id: `eq.${cart.id}` });
  await sbDelete('carts', { id: `eq.${cart.id}` });

  // คิวอาร์โค้ดเฉพาะพร้อมเพย์ — กระเป๋าเงินหักทันที / เงินสดปลายทางไม่ต้องมีคิวอาร์
  let qrImage: string | null = null;
  let payload: string | null = null;
  if (pm === 'promptpay') {
    payload = promptPayPayload(promptPayTarget, total, process.env.PROMPTPAY_BANK_CODE);
    qrImage = await QRCode.toDataURL(payload, { width: 320, margin: 1 });
  }
  return Response.json(
    {
      order,
      qrImage,
      payload,
      paymentMethod: pm,
      promotion: appliedPromotion ? { code: appliedPromotion.code, discount: promotionDiscount } : null,
    },
    { status: 201 },
  );
}
