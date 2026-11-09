import { NextRequest } from 'next/server';
import { requireRole } from '@/lib/portal';
import { sbList } from '@/lib/supabase';
import { jsonError } from '@/lib/api-user';

interface TaskRow {
  id: string;
  order_id: string;
  status: string;
  delivered_at: string | null;
  delivery_distance_km: number | null;
}

/** GET /api/driver/history — งานที่ส่งสำเร็จของฉัน (ล่าสุด 50 งาน) */
export async function GET(_req: NextRequest) {
  const user = await requireRole('driver');
  if (!user) return jsonError('เฉพาะไรเดอร์เท่านั้น', 403);

  const tasks = await sbList<TaskRow>('delivery_tasks', {
    driver_id: `eq.${user.id}`,
    status: 'eq.delivered',
    select: 'id,order_id,status,delivered_at,delivery_distance_km',
    order: 'delivered_at.desc.nullslast',
    limit: '50',
  });

  const orderIds = tasks.map((t) => t.order_id);
  const orders = orderIds.length
    ? await sbList<{ id: string; order_code: string; delivery_fee: number; restaurant_id: string }>('orders', {
        id: `in.(${orderIds.join(',')})`,
        select: 'id,order_code,delivery_fee,restaurant_id',
        limit: '100',
      })
    : [];
  const rstIds = [...new Set(orders.map((o) => o.restaurant_id))];
  const restaurants = rstIds.length
    ? await sbList<{ id: string; name: string }>('restaurants', {
        id: `in.(${rstIds.join(',')})`,
        select: 'id,name',
        limit: '100',
      })
    : [];

  return Response.json({
    data: tasks.map((t) => {
      const o = orders.find((x) => x.id === t.order_id);
      return {
        id: t.id,
        orderCode: o?.order_code ?? '-',
        deliveryFee: Number(o?.delivery_fee ?? 0),
        restaurantName: restaurants.find((r) => r.id === o?.restaurant_id)?.name ?? '-',
        deliveredAt: t.delivered_at,
        distanceKm: t.delivery_distance_km,
      };
    }),
  });
}
