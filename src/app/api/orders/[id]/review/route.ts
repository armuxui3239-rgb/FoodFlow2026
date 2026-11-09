import { NextRequest } from 'next/server';
import { sbInsert, sbList, sbOne } from '@/lib/supabase';
import { currentUser, jsonError } from '@/lib/api-user';

interface ReviewRow {
  id: string;
  order_id: string;
  food_rating: number;
  delivery_rating: number;
  comment: string | null;
  created_at: string;
}

/** ให้คะแนนได้เฉพาะออเดอร์ที่ส่งถึงแล้ว/สำเร็จ */
const RATEABLE_STATUS = new Set(['delivered', 'completed']);

function isValidRating(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= 5;
}

/** GET — รีวิวของคำสั่งซื้อนี้ (ของผู้ใช้เอง) ถ้ามี */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return jsonError('กรุณาเข้าสู่ระบบ', 401);
  const { id } = await ctx.params;

  const order = await sbOne<{ id: string }>('orders', {
    id: `eq.${id}`,
    customer_id: `eq.${user.id}`,
    select: 'id',
  });
  if (!order) return jsonError('ไม่พบคำสั่งซื้อ', 404);

  const review = await sbOne<ReviewRow>('reviews', {
    order_id: `eq.${id}`,
    select: 'id,order_id,food_rating,delivery_rating,comment,created_at',
    limit: '1',
  });
  return Response.json({ data: review });
}

/** POST — ส่งคะแนนรีวิวของคำสั่งซื้อ (หนึ่งครั้งต่อออเดอร์) */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return jsonError('กรุณาเข้าสู่ระบบ', 401);
  const { id } = await ctx.params;

  const { foodRating, deliveryRating, comment } = (await req.json().catch(() => ({}))) as {
    foodRating?: unknown;
    deliveryRating?: unknown;
    comment?: unknown;
  };

  if (!isValidRating(foodRating) || !isValidRating(deliveryRating)) {
    return jsonError('กรุณาให้คะแนนอาหารและการจัดส่งเป็นจำนวนเต็มระหว่าง 1 ถึง 5', 400);
  }
  const text = typeof comment === 'string' ? comment.trim() : '';
  if (text.length > 500) return jsonError('คอมเมนต์ต้องไม่เกิน 500 ตัวอักษร', 400);

  const order = await sbOne<{ id: string; status: string; restaurant_id: string }>('orders', {
    id: `eq.${id}`,
    customer_id: `eq.${user.id}`,
    select: 'id,status,restaurant_id',
  });
  if (!order) return jsonError('ไม่พบคำสั่งซื้อ', 404);
  if (!RATEABLE_STATUS.has(order.status)) {
    return jsonError('สามารถให้คะแนนได้หลังคำสั่งซื้อส่งถึงแล้วเท่านั้น', 400);
  }

  // กันให้คะแนนซ้ำ
  const existing = await sbList<{ id: string }>('reviews', {
    order_id: `eq.${id}`,
    select: 'id',
    limit: '1',
  });
  if (existing.length > 0) return jsonError('คุณให้คะแนนคำสั่งซื้อนี้แล้ว', 409);

  const [row] = await sbInsert<ReviewRow>('reviews', {
    order_id: order.id,
    customer_id: user.id,
    restaurant_id: order.restaurant_id,
    food_rating: foodRating,
    delivery_rating: deliveryRating,
    comment: text ? text : null,
  });
  return Response.json({ data: row }, { status: 201 });
}
