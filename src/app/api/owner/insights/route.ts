import { NextRequest } from 'next/server';
import { requireRole, getOwnerRestaurant } from '@/lib/portal';
import { sbList } from '@/lib/supabase';
import { jsonError } from '@/lib/api-user';

interface OrderRow {
  created_at: string;
}

interface ReviewRow {
  order_id: string;
  food_rating: number;
}

interface ItemRow {
  order_id: string;
  name_snapshot: string;
}

interface MenuItemRow {
  name: string;
}

/** ชื่อวันภาษาไทย (getUTCDay ของเวลาไทย: 0=อาทิตย์) */
export const DAY_TH = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];

/**
 * GET /api/owner/insights — ข้อเสนอแนะจากข้อมูลจริงของร้าน
 * - bestWeekday: วันที่ออเดอร์เยอะที่สุด (นับตามวันของ created_at + 7 ชม.)
 * - bestHour: ช่วงเวลาที่ออเดอร์เยอะที่สุด
 * - lowRated: เมนูที่ถูกรีวิวคะแนน <= 3 ตั้งแต่ 2 ครั้งขึ้นไป (ค่าเฉลี่ยต่ำกว่า 4)
 * - soldOut: เมนูที่ปิดขายอยู่
 */
export async function GET(_req: NextRequest) {
  const user = await requireRole('restaurant');
  if (!user) return jsonError('เฉพาะเจ้าของร้านเท่านั้น', 403);
  const owner = await getOwnerRestaurant(user.id);
  if (!owner) return jsonError('บัญชีนี้ยังไม่ผูกกับร้านอาหาร', 404);

  const bangkokToday = new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
  const from = new Date(`${bangkokToday}T00:00:00Z`);
  from.setUTCDate(from.getUTCDate() - 29);

  const orders = await sbList<OrderRow>('orders', {
    restaurant_id: `eq.${owner.restaurantId}`,
    select: 'created_at',
    created_at: `gte.${from.toISOString().slice(0, 10)}T00:00:00+07:00`,
    limit: '2000',
  });

  // วัน/ชั่วโมงที่ออเดอร์เยอะที่สุด (ไม่นับออเดอร์ที่ยกเลิก)
  const byWeekday = new Map<number, number>();
  const byHour = new Map<number, number>();
  for (const o of orders) {
    const th = new Date(new Date(o.created_at).getTime() + 7 * 3600_000);
    const day = th.getUTCDay();
    const hour = th.getUTCHours();
    byWeekday.set(day, (byWeekday.get(day) ?? 0) + 1);
    byHour.set(hour, (byHour.get(hour) ?? 0) + 1);
  }
  const topWeekday = [...byWeekday.entries()].sort((a, b) => b[1] - a[1])[0] ?? null;
  const topHour = [...byHour.entries()].sort((a, b) => b[1] - a[1])[0] ?? null;

  // เมนูคะแนนต่ำ: รีวิว <= 3 → หา order_items ของออเดอร์นั้น → จับกลุ่มตามชื่อเมนู
  const lowReviews = await sbList<ReviewRow>('reviews', {
    restaurant_id: `eq.${owner.restaurantId}`,
    food_rating: 'lte.3',
    select: 'order_id,food_rating',
    limit: '500',
  });
  let lowRated: { name: string; count: number; avg: number }[] = [];
  if (lowReviews.length > 0) {
    const reviewOrderIds = [...new Set(lowReviews.map((r) => r.order_id))];
    const items = await sbList<ItemRow>('order_items', {
      order_id: `in.(${reviewOrderIds.join(',')})`,
      select: 'order_id,name_snapshot',
      limit: '1000',
    });
    const ratingByOrder = new Map<string, number[]>();
    for (const r of lowReviews) {
      const arr = ratingByOrder.get(r.order_id) ?? [];
      arr.push(Number(r.food_rating));
      ratingByOrder.set(r.order_id, arr);
    }
    const byName = new Map<string, number[]>();
    for (const it of items) {
      const ratings = ratingByOrder.get(it.order_id) ?? [];
      const arr = byName.get(it.name_snapshot) ?? [];
      arr.push(...ratings);
      byName.set(it.name_snapshot, arr);
    }
    lowRated = [...byName.entries()]
      .filter(([, ratings]) => ratings.length >= 2 && ratings.reduce((s, r) => s + r, 0) / ratings.length < 4)
      .map(([name, ratings]) => ({
        name,
        count: ratings.length,
        avg: Math.round((ratings.reduce((s, r) => s + r, 0) / ratings.length) * 10) / 10,
      }))
      .sort((a, b) => a.avg - b.avg)
      .slice(0, 5);
  }

  // เมนูหมดวันนี้ (ปิดขายอยู่)
  const soldOutRows = await sbList<MenuItemRow>('menu_items', {
    restaurant_id: `eq.${owner.restaurantId}`,
    is_available: 'eq.false',
    select: 'name',
    limit: '50',
  });

  return Response.json({
    bestWeekday: topWeekday ? { day: topWeekday[0], dayLabel: DAY_TH[topWeekday[0]], count: topWeekday[1] } : null,
    bestHour: topHour ? { hour: topHour[0], count: topHour[1] } : null,
    lowRated,
    soldOut: soldOutRows.map((m) => m.name),
  });
}
