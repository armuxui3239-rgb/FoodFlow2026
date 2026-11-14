import { NextRequest } from 'next/server';
import { requireRole } from '@/lib/portal';
import { sbList } from '@/lib/supabase';
import { jsonError } from '@/lib/api-user';

interface OrderRow {
  status: string;
  subtotal: number;
  total: number;
  commission_rate_at_order_time: number | null;
  created_at: string;
}

export interface ReportPerDay {
  date: string;
  orders: number;
  gmv: number;
}

const DONE = ['delivered', 'completed'];

/** GET /api/admin/reports?days=7|30|90 — สรุปยอดขาย ผู้ใช้ใหม่ ร้านใหม่ และยอดรายวัน */
export async function GET(req: NextRequest) {
  const user = await requireRole('admin');
  if (!user) return jsonError('เฉพาะผู้ดูแลระบบเท่านั้น', 403);

  const sp = req.nextUrl.searchParams;
  const days = [7, 30, 90].includes(Number(sp.get('days'))) ? Number(sp.get('days')) : 30;
  const from = new Date(Date.now() - days * 86400_000).toISOString();

  const orders = await sbList<OrderRow>('orders', {
    created_at: `gte.${from}`,
    select: 'status,subtotal,total,commission_rate_at_order_time,created_at',
    order: 'created_at.asc',
    limit: '10000',
  });

  // สรุปยอดรวม — GMV และคอมมิชชันนับจากออเดอร์ที่ส่งสำเร็จเท่านั้น
  const done = orders.filter((o) => DONE.includes(o.status));
  const gmv = done.reduce((s, o) => s + (o.total ?? 0), 0);
  const commission = done.reduce(
    (s, o) => s + Math.round((o.subtotal ?? 0) * ((o.commission_rate_at_order_time ?? 0) / 100)),
    0,
  );

  // ผู้ใช้ใหม่ + ร้านใหม่ในช่วงเวลาเดียวกัน
  const newUsers = await sbList<{ id: string }>('users', {
    created_at: `gte.${from}`,
    select: 'id',
    limit: '10000',
  });
  let newRestaurants = 0;
  try {
    const rst = await sbList<{ id: string }>('restaurants', {
      created_at: `gte.${from}`,
      select: 'id',
      limit: '10000',
    });
    newRestaurants = rst.length;
  } catch {
    newRestaurants = 0; // ตารางไม่มีคอลัมน์ created_at — ไม่ทำให้หน้ารายงานล้ม
  }

  // ยอดรายวัน (เขตเวลาไทย +07:00) — เติมวันที่ไม่มีออเดอร์ให้ครบทุกวัน
  const buckets = new Map<string, { orders: number; gmv: number }>();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() + 7 * 3600_000 - i * 86400_000);
    buckets.set(d.toISOString().slice(0, 10), { orders: 0, gmv: 0 });
  }
  for (const o of orders) {
    const key = new Date(new Date(o.created_at).getTime() + 7 * 3600_000).toISOString().slice(0, 10);
    const b = buckets.get(key);
    if (b) {
      b.orders += 1;
      if (DONE.includes(o.status)) b.gmv += o.total ?? 0;
    }
  }
  const perDay: ReportPerDay[] = [...buckets.entries()].map(([date, v]) => ({ date, ...v }));

  return Response.json({
    days,
    totals: {
      count: orders.length,
      gmv,
      commission,
      cancelled: orders.filter((o) => ['cancelled', 'refunded'].includes(o.status)).length,
      newUsers: newUsers.length,
      newRestaurants,
    },
    perDay,
  });
}
