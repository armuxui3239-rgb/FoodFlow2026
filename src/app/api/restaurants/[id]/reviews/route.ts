import { sbList } from '@/lib/supabase';

interface ReviewRow {
  id: string;
  food_rating: number;
  delivery_rating: number;
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

/** GET (public) — รีวิวล่าสุดของร้าน + คะแนนเฉลี่ยจากรีวิวที่แสดงได้ (ไม่ต้องเข้าสู่ระบบ) */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  const reviews = await sbList<ReviewRow>('reviews', {
    restaurant_id: `eq.${id}`,
    is_hidden: 'eq.false',
    select: 'id,food_rating,delivery_rating,comment,created_at,reply,reply_at,customer_id',
    order: 'created_at.desc',
    limit: '20',
  });

  const count = reviews.length;
  const average =
    count === 0
      ? 0
      : Number((reviews.reduce((s, r) => s + (typeof r.food_rating === 'number' ? r.food_rating : 0), 0) / count).toFixed(1));

  // ดึงชื่อลูกค้ามาแสดง (รวมเป็น query เดียวด้วย in.())
  const customerIds = [...new Set(reviews.map((r) => r.customer_id))];
  const users =
    customerIds.length > 0
      ? await sbList<UserRow>('users', {
          id: `in.(${customerIds.join(',')})`,
          select: 'id,full_name',
        })
      : [];
  const nameById = new Map(users.map((u) => [u.id, u.full_name]));

  return Response.json({
    data: {
      average,
      count,
      reviews: reviews.map((r) => ({
        id: r.id,
        food_rating: r.food_rating,
        delivery_rating: r.delivery_rating,
        comment: r.comment,
        createdAt: r.created_at,
        reply: r.reply,
        replyAt: r.reply_at,
        customerName: nameById.get(r.customer_id)?.trim() || 'ลูกค้าฟู๊ด ธันเดอร์',
      })),
    },
  });
}
