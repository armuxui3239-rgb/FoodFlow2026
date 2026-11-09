import { NextRequest } from 'next/server';
import { requireRole, getOwnerRestaurant } from '@/lib/portal';
import { sbList } from '@/lib/supabase';
import { jsonError } from '@/lib/api-user';

/** GET /api/owner/me — ข้อมูลร้านของฉัน + สถิติวันนี้ (เขตเวลาไทย) */
export async function GET(_req: NextRequest) {
  const user = await requireRole('restaurant');
  if (!user) return jsonError('เฉพาะเจ้าของร้านเท่านั้น', 403);
  const owner = await getOwnerRestaurant(user.id);
  if (!owner) return jsonError('บัญชีนี้ยังไม่ผูกกับร้านอาหาร', 404);

  const bangkokToday = new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
  const todays = await sbList<{ status: string; total: number }>('orders', {
    restaurant_id: `eq.${owner.restaurantId}`,
    created_at: `gte.${bangkokToday}T00:00:00+07:00`,
    select: 'status,total',
    limit: '1000',
  });

  const revenue = todays
    .filter((o) => ['delivered', 'completed'].includes(o.status))
    .reduce((s, o) => s + Number(o.total), 0);

  return Response.json({
    restaurant: { id: owner.restaurantId, name: owner.restaurantName, isOpen: owner.isOpen },
    stats: {
      todayOrders: todays.length,
      incoming: todays.filter((o) => o.status === 'paid').length,
      active: todays.filter((o) =>
        ['restaurant_accepted', 'preparing', 'ready_for_pickup', 'driver_assigned', 'picked_up', 'delivering'].includes(o.status),
      ).length,
      revenueSatang: revenue,
    },
  });
}
