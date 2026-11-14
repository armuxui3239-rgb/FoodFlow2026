import { requireRole, getOwnerRestaurant } from '@/lib/portal';
import { sbList } from '@/lib/supabase';
import { jsonError } from '@/lib/api-user';

interface OrderRow {
  id: string;
  status: string;
  subtotal: number;
  created_at: string;
}

interface ItemRow {
  order_id: string;
  name_snapshot: string;
  quantity: number;
  unit_price: number;
}

function shiftDate(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * GET /api/owner/analytics — วิเคราะห์ 30 วันล่าสุดของร้านฉัน
 * - perDay: ยอดขาย/ออเดอร์รายวัน (delivered/completed)
 * - topItems: 10 เมนูที่ทำรายได้สูงสุด (จาก order_items)
 * - statuses: การกระจายสถานะออเดอร์ทั้งหมดใน 30 วัน
 */
export async function GET() {
  const user = await requireRole('restaurant');
  if (!user) return jsonError('เฉพาะเจ้าของร้านเท่านั้น', 403);
  const owner = await getOwnerRestaurant(user.id);
  if (!owner) return jsonError('บัญชีนี้ยังไม่ผูกกับร้านอาหาร', 404);

  const bangkokToday = new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);

  const orders = await sbList<OrderRow>('orders', {
    restaurant_id: `eq.${owner.restaurantId}`,
    select: 'id,status,subtotal,created_at',
    created_at: `gte.${shiftDate(bangkokToday, -29)}T00:00:00+07:00`,
    order: 'created_at.desc',
    limit: '2000',
  });

  // วันที่แบบเวลาไทย (YYYY-MM-DD)
  const thDate = (iso: string) => new Date(new Date(iso).getTime() + 7 * 3600_000).toISOString().slice(0, 10);
  const success = orders.filter((o) => o.status === 'delivered' || o.status === 'completed');

  // ยอดขายรายวัน 30 วัน
  const byDay = new Map<string, { orders: number; revenue: number }>();
  for (const o of success) {
    const d = thDate(o.created_at);
    const cur = byDay.get(d) ?? { orders: 0, revenue: 0 };
    cur.orders += 1;
    cur.revenue += o.subtotal;
    byDay.set(d, cur);
  }
  const perDay = Array.from({ length: 30 }, (_, i) => {
    const date = shiftDate(bangkokToday, i - 29);
    const hit = byDay.get(date) ?? { orders: 0, revenue: 0 };
    return { date, orders: hit.orders, revenue: hit.revenue };
  });

  // เมนูขายดีตามรายได้
  const ids = success.map((o) => o.id);
  const items = ids.length
    ? await sbList<ItemRow>('order_items', {
        order_id: `in.(${ids.join(',')})`,
        select: 'order_id,name_snapshot,quantity,unit_price',
        limit: '1000',
      })
    : [];
  const byName = new Map<string, { name: string; quantity: number; revenue: number }>();
  for (const it of items) {
    const cur = byName.get(it.name_snapshot) ?? { name: it.name_snapshot, quantity: 0, revenue: 0 };
    cur.quantity += it.quantity;
    cur.revenue += it.quantity * it.unit_price;
    byName.set(it.name_snapshot, cur);
  }
  const topItems = [...byName.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 10);

  // การกระจายสถานะออเดอร์
  const statusCounts = new Map<string, number>();
  for (const o of orders) statusCounts.set(o.status, (statusCounts.get(o.status) ?? 0) + 1);
  const statuses = [...statusCounts.entries()].map(([status, count]) => ({ status, count })).sort((a, b) => b.count - a.count);

  return Response.json({ perDay, topItems, statuses });
}
