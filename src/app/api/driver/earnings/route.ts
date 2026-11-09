import { NextRequest } from 'next/server';
import { requireRole } from '@/lib/portal';
import { sbList, sbOne } from '@/lib/supabase';
import { jsonError } from '@/lib/api-user';

/** GET /api/driver/earnings — รายได้รวม + รายวัน 7 วัน (จาก delivery_tasks delivered จริง) */
export async function GET(_req: NextRequest) {
  const user = await requireRole('driver');
  if (!user) return jsonError('เฉพาะไรเดอร์เท่านั้น', 403);

  const prof = await sbOne<{ total_earnings: number | null; total_deliveries: number | null; rating: number | null }>(
    'driver_profiles',
    { user_id: `eq.${user.id}`, select: 'total_earnings,total_deliveries,rating' },
  );

  const sinceIso = new Date(Date.now() + 7 * 3600_000 - 7 * 86400_000).toISOString().slice(0, 10) + 'T00:00:00+07:00';
  const tasks = await sbList<{ order_id: string; delivered_at: string | null }>('delivery_tasks', {
    driver_id: `eq.${user.id}`,
    status: 'eq.delivered',
    delivered_at: `gte.${sinceIso}`,
    select: 'order_id,delivered_at',
    order: 'delivered_at.desc.nullslast',
    limit: '500',
  });

  const orderIds = tasks.map((t) => t.order_id);
  const orders = orderIds.length
    ? await sbList<{ id: string; delivery_fee: number }>('orders', {
        id: `in.(${orderIds.join(',')})`,
        select: 'id,delivery_fee',
        limit: '500',
      })
    : [];
  const feeByOrder = new Map(orders.map((o) => [o.id, Number(o.delivery_fee)]));

  const byDay = new Map<string, { earning: number; count: number }>();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() + 7 * 3600_000 - i * 86400_000);
    byDay.set(d.toISOString().slice(0, 10), { earning: 0, count: 0 });
  }
  let weekEarning = 0;
  for (const t of tasks) {
    if (!t.delivered_at) continue;
    const day = new Date(new Date(t.delivered_at).getTime() + 7 * 3600_000).toISOString().slice(0, 10);
    const slot = byDay.get(day);
    const fee = feeByOrder.get(t.order_id) ?? 0;
    weekEarning += fee;
    if (slot) {
      slot.earning += fee;
      slot.count += 1;
    }
  }

  return Response.json({
    totalEarningsSatang: Number(prof?.total_earnings ?? 0),
    totalDeliveries: prof?.total_deliveries ?? 0,
    rating: prof?.rating ?? 0,
    weekEarningsSatang: weekEarning,
    weekTrips: tasks.length,
    days: [...byDay.entries()].map(([date, v]) => ({ date, ...v })),
  });
}
