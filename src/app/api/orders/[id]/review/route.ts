import { NextRequest } from 'next/server';
import { sbInsert, sbList, sbOne, sbUpdate } from '@/lib/supabase';
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

  const order = await sbOne<{ id: string; status: string; restaurant_id: string; driver_id: string | null }>('orders', {
    id: `eq.${id}`,
    customer_id: `eq.${user.id}`,
    select: 'id,status,restaurant_id,driver_id',
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

  const [row] = await sbInsert<ReviewRow & { restaurant_id: string; driver_id: string | null }>('reviews', {
    order_id: order.id,
    customer_id: user.id,
    restaurant_id: order.restaurant_id,
    driver_id: order.driver_id,
    food_rating: foodRating,
    delivery_rating: deliveryRating,
    comment: text ? text : null,
  });

  // ---- คำนวณคะแนนเฉลี่ยใหม่ทันที (ร้าน + ไรเดอร์) เพื่อให้หน้าเว็บโชว์ตรงจริงเสมอ ----
  try {
    // 1) ร้าน: rating = เฉลี่ย (food+delivery)/2 ปัด 1 ตำแหน่ง, total_reviews = จำนวนรีวิวจริง
    const revs = await sbList<{ food_rating: number; delivery_rating: number }>('reviews', {
      restaurant_id: `eq.${order.restaurant_id}`,
      select: 'food_rating,delivery_rating',
      limit: '10000',
    });
    if (revs.length > 0) {
      const avg = Math.round((revs.reduce((s, r) => s + (r.food_rating + r.delivery_rating) / 2, 0) / revs.length) * 10) / 10;
      await sbUpdate('restaurants', { id: `eq.${order.restaurant_id}` }, { rating: avg, total_reviews: revs.length });
    }

    // 2) ไรเดอร์: rating = เฉลี่ย delivery_rating ของรีวิวที่ระบุไรเดอร์
    if (order.driver_id) {
      const drevs = await sbList<{ delivery_rating: number }>('reviews', {
        driver_id: `eq.${order.driver_id}`,
        select: 'delivery_rating',
        limit: '10000',
      });
      if (drevs.length > 0) {
        const dAvg = Math.round((drevs.reduce((s, r) => s + r.delivery_rating, 0) / drevs.length) * 10) / 10;
        // orders.driver_id ชี้ไปที่ users.id ของไรเดอร์ → ต้องอัปเดต driver_profiles ด้วย user_id
        await sbUpdate('driver_profiles', { user_id: `eq.${order.driver_id}` }, { rating: dAvg });
      }
    }
  } catch {
    // คำนวณคะแนนล้มเหลวไม่ควรทำให้การส่งรีวิวพัง — รีวิวบันทึกสำเร็จแล้ว
  }

  return Response.json({ data: row }, { status: 201 });
}
