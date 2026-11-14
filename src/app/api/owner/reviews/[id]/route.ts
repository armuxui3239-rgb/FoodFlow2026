import { NextRequest } from 'next/server';
import { requireRole, getOwnerRestaurant } from '@/lib/portal';
import { sbOne, sbUpdate } from '@/lib/supabase';
import { jsonError } from '@/lib/api-user';

/** PATCH /api/owner/reviews/[id] — ตอบรีวิว { reply } (ต้องเป็นรีวิวของร้านฉัน) */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await requireRole('restaurant');
  if (!user) return jsonError('เฉพาะเจ้าของร้านเท่านั้น', 403);
  const owner = await getOwnerRestaurant(user.id);
  if (!owner) return jsonError('บัญชีนี้ยังไม่ผูกกับร้านอาหาร', 404);

  const { id } = await ctx.params;
  const review = await sbOne<{ id: string }>('reviews', {
    id: `eq.${id}`,
    restaurant_id: `eq.${owner.restaurantId}`,
    select: 'id',
  });
  if (!review) return jsonError('ไม่พบรีวิวของร้านคุณ', 404);

  const { reply } = (await req.json().catch(() => ({}))) as { reply?: string };
  const text = reply?.trim();
  if (!text) return jsonError('กรุณาพิมพ์ข้อความตอบรีวิว', 400);
  if (text.length > 1000) return jsonError('ข้อความตอบรีวิวยาวเกินไป (สูงสุด 1,000 ตัวอักษร)', 400);

  const now = new Date().toISOString();
  const [updated] = await sbUpdate<{ id: string; reply: string; reply_at: string }>(
    'reviews',
    { id: `eq.${id}` },
    { reply: text, reply_at: now },
  );
  return Response.json({ ok: true, reply: updated?.reply ?? text, replyAt: updated?.reply_at ?? now });
}
