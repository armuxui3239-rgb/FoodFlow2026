import { NextRequest } from 'next/server';
import { requireRole } from '@/lib/portal';
import { sbList } from '@/lib/supabase';
import { jsonError } from '@/lib/api-user';

interface OrderRow {
  status: string;
  restaurant_id: string;
  total: number;
}

interface TaskRow {
  driver_id: string;
}

interface NameRow {
  id: string;
  name?: string;
  full_name?: string;
}

const DONE = ['delivered', 'completed'];

/** GET /api/admin/analytics — กระจายสถานะออเดอร์ + ร้าน/ไรเดอร์ top 5 + ยอดเฉลี่ยต่อบิล */
export async function GET(_req: NextRequest) {
  const user = await requireRole('admin');
  if (!user) return jsonError('เฉพาะผู้ดูแลระบบเท่านั้น', 403);

  const orders = await sbList<OrderRow>('orders', {
    select: 'status,restaurant_id,total',
    limit: '10000',
  });

  // กระจายตามสถานะ
  const statusDist = orders.reduce<Record<string, number>>((acc, o) => {
    acc[o.status] = (acc[o.status] ?? 0) + 1;
    return acc;
  }, {});

  // ร้าน top 5 ตามยอดขาย (ส่งสำเร็จเท่านั้น)
  const byRestaurant = new Map<string, { revenue: number; orders: number }>();
  for (const o of orders) {
    if (!DONE.includes(o.status) || !o.restaurant_id) continue;
    const b = byRestaurant.get(o.restaurant_id) ?? { revenue: 0, orders: 0 };
    b.revenue += o.total ?? 0;
    b.orders += 1;
    byRestaurant.set(o.restaurant_id, b);
  }
  const topRestaurantsIds = [...byRestaurant.entries()]
    .sort((a, b) => b[1].revenue - a[1].revenue)
    .slice(0, 5);
  const rNames = topRestaurantsIds.length
    ? await sbList<NameRow>('restaurants', {
        id: `in.(${topRestaurantsIds.map(([id]) => id).join(',')})`,
        select: 'id,name',
        limit: '5',
      })
    : [];
  const topRestaurants = topRestaurantsIds.map(([id, v]) => ({
    id,
    name: rNames.find((r) => r.id === id)?.name ?? 'ร้านค้า',
    revenue: v.revenue,
    orders: v.orders,
  }));

  // ไรเดอร์ top 5 ตามจำนวนงานส่งสำเร็จ
  const tasks = await sbList<TaskRow>('delivery_tasks', {
    status: 'eq.delivered',
    select: 'driver_id',
    limit: '10000',
  });
  const byDriver = new Map<string, number>();
  for (const t of tasks) {
    if (!t.driver_id) continue;
    byDriver.set(t.driver_id, (byDriver.get(t.driver_id) ?? 0) + 1);
  }
  const topDriverIds = [...byDriver.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const dNames = topDriverIds.length
    ? await sbList<NameRow>('users', {
        id: `in.(${topDriverIds.map(([id]) => id).join(',')})`,
        select: 'id,full_name',
        limit: '5',
      })
    : [];
  const topDrivers = topDriverIds.map(([id, count]) => ({
    id,
    name: dNames.find((d) => d.id === id)?.full_name ?? 'ไรเดอร์',
    deliveries: count,
  }));

  // ยอดเฉลี่ยต่อบิล (ออเดอร์ส่งสำเร็จ)
  const doneOrders = orders.filter((o) => DONE.includes(o.status));
  const gmv = doneOrders.reduce((s, o) => s + (o.total ?? 0), 0);
  const avgOrderValue = doneOrders.length ? Math.round(gmv / doneOrders.length) : 0;

  return Response.json({
    statusDist,
    topRestaurants,
    topDrivers,
    totals: { orders: orders.length, gmv, avgOrderValue, delivered: doneOrders.length },
  });
}
