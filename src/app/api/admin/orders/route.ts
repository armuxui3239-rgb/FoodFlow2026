import { NextRequest } from 'next/server';
import { requireRole } from '@/lib/portal';
import { sbList } from '@/lib/supabase';
import { jsonError } from '@/lib/api-user';

interface OrderRow {
  id: string;
  order_code: string;
  status: string;
  total: number;
  created_at: string;
  restaurant_id: string;
  customer_id: string;
}

/** GET /api/admin/orders — ออเดอร์ล่าสุดทั้งระบบ พร้อมชื่อร้าน/ลูกค้า */
export async function GET(req: NextRequest) {
  const user = await requireRole('admin');
  if (!user) return jsonError('เฉพาะผู้ดูแลระบบเท่านั้น', 403);

  const limit = Math.min(Number(req.nextUrl.searchParams.get('limit') ?? 30), 100);
  const orders = await sbList<OrderRow>('orders', {
    select: 'id,order_code,status,total,created_at,restaurant_id,customer_id',
    order: 'created_at.desc',
    limit: String(limit),
  });
  const rstIds = [...new Set(orders.map((o) => o.restaurant_id))];
  const cusIds = [...new Set(orders.map((o) => o.customer_id))];
  const restaurants = rstIds.length
    ? await sbList<{ id: string; name: string }>('restaurants', { id: `in.(${rstIds.join(',')})`, select: 'id,name', limit: '200' })
    : [];
  const customers = cusIds.length
    ? await sbList<{ id: string; full_name: string }>('users', { id: `in.(${cusIds.join(',')})`, select: 'id,full_name', limit: '200' })
    : [];

  return Response.json({
    data: orders.map((o) => ({
      ...o,
      restaurantName: restaurants.find((r) => r.id === o.restaurant_id)?.name ?? '-',
      customerName: customers.find((c) => c.id === o.customer_id)?.full_name ?? '-',
    })),
  });
}
