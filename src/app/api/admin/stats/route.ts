import { NextRequest } from 'next/server';
import { requireRole } from '@/lib/portal';
import { sbList } from '@/lib/supabase';
import { jsonError } from '@/lib/api-user';

/** GET /api/admin/stats — ภาพรวมทั้งระบบ (นับจากฐานข้อมูลจริงทุกครั้ง) */
export async function GET(_req: NextRequest) {
  const user = await requireRole('admin');
  if (!user) return jsonError('เฉพาะผู้ดูแลระบบเท่านั้น', 403);

  const [users, restaurants, orders, drivers] = await Promise.all([
    sbList<{ role: string; is_active: boolean }>('users', { select: 'role,is_active', limit: '1000' }),
    sbList<{ approval_status: string; is_open: boolean }>('restaurants', { select: 'approval_status,is_open', limit: '1000' }),
    sbList<{ status: string; total: number; created_at: string }>('orders', {
      select: 'status,total,created_at',
      order: 'created_at.desc',
      limit: '1000',
    }),
    sbList<{ is_online: boolean }>('driver_profiles', { select: 'is_online', limit: '1000' }),
  ]);

  const byRole: Record<string, number> = {};
  users.forEach((u) => {
    byRole[u.role] = (byRole[u.role] ?? 0) + 1;
  });
  const byStatus: Record<string, number> = {};
  orders.forEach((o) => {
    byStatus[o.status] = (byStatus[o.status] ?? 0) + 1;
  });

  const bangkokToday = new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
  const todays = orders.filter((o) => o.created_at >= `${bangkokToday}T00:00:00+07:00`);

  return Response.json({
    users: {
      total: users.length,
      byRole,
      active: users.filter((u) => u.is_active).length,
    },
    restaurants: {
      total: restaurants.length,
      approved: restaurants.filter((r) => r.approval_status === 'approved').length,
      open: restaurants.filter((r) => r.is_open).length,
    },
    orders: {
      total: orders.length,
      byStatus,
      today: todays.length,
      gmvTodaySatang: todays
        .filter((o) => ['paid', 'restaurant_accepted', 'preparing', 'ready_for_pickup', 'driver_assigned', 'picked_up', 'delivering', 'delivered', 'completed'].includes(o.status))
        .reduce((s, o) => s + Number(o.total), 0),
    },
    drivers: {
      total: drivers.length,
      online: drivers.filter((d) => d.is_online).length,
    },
  });
}
