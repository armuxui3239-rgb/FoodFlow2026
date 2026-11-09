import { NextRequest } from 'next/server';
import { requireRole, getOwnerRestaurant } from '@/lib/portal';
import { sbList } from '@/lib/supabase';
import { jsonError } from '@/lib/api-user';

/** GET /api/owner/stats — ยอดขาย 7 วัน + เมนูขายดี (จากออเดอร์จริง) */
export async function GET(_req: NextRequest) {
  const user = await requireRole('restaurant');
  if (!user) return jsonError('เฉพาะเจ้าของร้านเท่านั้น', 403);
  const owner = await getOwnerRestaurant(user.id);
  if (!owner) return jsonError('บัญชีนี้ยังไม่ผูกกับร้านอาหาร', 404);

  const since = new Date(Date.now() + 7 * 3600_000 - 7 * 86400_000);
  const sinceIso = since.toISOString().slice(0, 10) + 'T00:00:00+07:00';

  const orders = await sbList<{ total: number; created_at: string; status: string }>('orders', {
    restaurant_id: `eq.${owner.restaurantId}`,
    created_at: `gte.${sinceIso}`,
    status: 'in.(delivered,completed)',
    select: 'total,created_at,status',
    order: 'created_at.asc',
    limit: '1000',
  });

  // ยอดรายวัน (เขตเวลาไทย)
  const byDay = new Map<string, { revenue: number; count: number }>();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() + 7 * 3600_000 - i * 86400_000);
    byDay.set(d.toISOString().slice(0, 10), { revenue: 0, count: 0 });
  }
  for (const o of orders) {
    const day = new Date(new Date(o.created_at).getTime() + 7 * 3600_000).toISOString().slice(0, 10);
    const slot = byDay.get(day);
    if (slot) {
      slot.revenue += Number(o.total);
      slot.count += 1;
    }
  }

  // เมนูขายดี: ดึง order_items ของออเดอร์ช่วง 7 วัน
  const allOrders = await sbList<{ id: string }>('orders', {
    restaurant_id: `eq.${owner.restaurantId}`,
    created_at: `gte.${sinceIso}`,
    status: 'in.(delivered,completed)',
    select: 'id',
    limit: '1000',
  });
  const ids = allOrders.map((o) => o.id);
  const items2 = ids.length
    ? await sbList<{ name_snapshot: string; quantity: number }>('order_items', {
        order_id: `in.(${ids.join(',')})`,
        select: 'name_snapshot,quantity',
        limit: '1000',
      })
    : [];
  const byItem = new Map<string, number>();
  for (const it of items2) {
    byItem.set(it.name_snapshot, (byItem.get(it.name_snapshot) ?? 0) + Number(it.quantity));
  }
  const topItems = [...byItem.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, qty]) => ({ name, qty }));

  return Response.json({
    days: [...byDay.entries()].map(([date, v]) => ({ date, ...v })),
    totalRevenueSatang: orders.reduce((s, o) => s + Number(o.total), 0),
    totalOrders: orders.length,
    topItems,
  });
}
