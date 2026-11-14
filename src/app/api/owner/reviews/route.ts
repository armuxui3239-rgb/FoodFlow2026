import { NextRequest } from 'next/server';
import { requireRole, getOwnerRestaurant } from '@/lib/portal';
import { sbList } from '@/lib/supabase';
import { jsonError } from '@/lib/api-user';

interface ReviewRow {
  id: string;
  order_id: string;
  food_rating: number;
  delivery_rating: number | null;
  comment: string | null;
  created_at: string;
  reply: string | null;
  reply_at: string | null;
  customer_id: string;
}

interface UserRow {
  id: string;
  full_name: string;
}

/** GET /api/owner/reviews — รีวิวของร้านฉัน (ล่าสุด 50 รายการ) พร้อมชื่อลูกค้า */
export async function GET(_req: NextRequest) {
  const user = await requireRole('restaurant');
  if (!user) return jsonError('เฉพาะเจ้าของร้านเท่านั้น', 403);
  const owner = await getOwnerRestaurant(user.id);
  if (!owner) return jsonError('บัญชีนี้ยังไม่ผูกกับร้านอาหาร', 404);

  const reviews = await sbList<ReviewRow>('reviews', {
    restaurant_id: `eq.${owner.restaurantId}`,
    is_hidden: 'eq.false',
    select: 'id,order_id,food_rating,delivery_rating,comment,created_at,reply,reply_at,customer_id',
    order: 'created_at.desc',
    limit: '50',
  });

  // ดึงชื่อลูกค้ามาแสดง (รวมเป็น query เดียวด้วย in.() ตามรูปแบบรีวิวหน้าร้าน)
  const customerIds = [...new Set(reviews.map((r) => r.customer_id))];
  const users =
    customerIds.length > 0
      ? await sbList<UserRow>('users', {
          id: `in.(${customerIds.join(',')})`,
          select: 'id,full_name',
        })
      : [];
  const nameById = new Map(users.map((u) => [u.id, u.full_name]));

  const rated = reviews.filter((r) => typeof r.food_rating === 'number');
  const average =
    rated.length === 0 ? 0 : Number((rated.reduce((s, r) => s + Number(r.food_rating), 0) / rated.length).toFixed(1));

  return Response.json({
    data: reviews.map((r) => ({
      id: r.id,
      orderId: r.order_id,
      foodRating: r.food_rating,
      deliveryRating: r.delivery_rating,
      comment: r.comment,
      createdAt: r.created_at,
      reply: r.reply,
      replyAt: r.reply_at,
      customerName: nameById.get(r.customer_id)?.trim() || 'ลูกค้าฟู๊ด ธันเดอร์',
    })),
    average,
    count: reviews.length,
  });
}
