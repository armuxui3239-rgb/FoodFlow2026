import { NextRequest } from 'next/server';
import { requireRole } from '@/lib/portal';
import { sbList } from '@/lib/supabase';
import { jsonError } from '@/lib/api-user';

interface ReviewRow {
  id: string;
  order_id: string;
  delivery_rating: number | null;
  comment: string | null;
  reply: string | null;
  created_at: string;
}

/** GET /api/driver/ratings — คะแนนการจัดส่งที่ลูกค้าให้ฉัน + เฉลี่ยรวม */
export async function GET(_req: NextRequest) {
  const user = await requireRole('driver');
  if (!user) return jsonError('เฉพาะไรเดอร์เท่านั้น', 403);

  const reviews = await sbList<ReviewRow>('reviews', {
    driver_id: `eq.${user.id}`,
    is_hidden: 'eq.false',
    select: 'id,order_id,delivery_rating,comment,reply,created_at',
    order: 'created_at.desc.nullslast',
    limit: '50',
  });

  const orderIds = [...new Set(reviews.map((r) => r.order_id))];
  const orders = orderIds.length
    ? await sbList<{ id: string; order_code: string }>('orders', {
        id: `in.(${orderIds.join(',')})`,
        select: 'id,order_code',
        limit: '100',
      })
    : [];
  const codeByOrder = new Map(orders.map((o) => [o.id, o.order_code]));

  const rated = reviews.filter((r) => r.delivery_rating != null);
  const avg = rated.length ? rated.reduce((s, r) => s + Number(r.delivery_rating), 0) / rated.length : 0;

  return Response.json({
    average: Math.round(avg * 10) / 10,
    total: rated.length,
    data: reviews.map((r) => ({
      id: r.id,
      orderCode: codeByOrder.get(r.order_id) ?? '-',
      rating: r.delivery_rating,
      comment: r.comment,
      reply: r.reply,
      createdAt: r.created_at,
    })),
  });
}
