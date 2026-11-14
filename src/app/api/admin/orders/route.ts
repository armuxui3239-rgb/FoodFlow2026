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

/** กลุ่มสถานะสำหรับแท็บตัวกรอง (group) */
const GROUPS: Record<string, string[]> = {
  active: ['paid', 'restaurant_accepted', 'preparing', 'ready_for_pickup', 'driver_assigned', 'picked_up', 'delivering'],
  done: ['delivered', 'completed'],
  cancelled: ['cancelled', 'refunded'],
};

/**
 * GET /api/admin/orders — ออเดอร์ทั้งระบบ พร้อมชื่อร้าน/ชื่อลูกค้า
 * ตัวกรอง (ไม่ใส่ = พฤติกรรมเดิม: ออเดอร์ล่าสุด limit 30):
 *  - group=active|done|cancelled
 *  - status=สถานะเดี่ยวหรือคั่นด้วยจุลภาค เช่น paid,preparing (ใช้เมื่อไม่ระบุ group)
 *  - restaurantId=รหัสร้าน (กรองเฉพาะร้านเดียว)
 *  - from=YYYY-MM-DD&to=YYYY-MM-DD (เวลาไทย +07:00)
 *  - q=รหัสออเดอร์ (ค้นหาแบบไม่สนตัวพิมพ์)
 *  - limit (สูงสุด 200)
 */
export async function GET(req: NextRequest) {
  const user = await requireRole('admin');
  if (!user) return jsonError('เฉพาะผู้ดูแลระบบเท่านั้น', 403);

  const sp = req.nextUrl.searchParams;
  const group = sp.get('group');
  const status = sp.get('status');
  const restaurantId = sp.get('restaurantId')?.trim();
  const from = sp.get('from');
  const to = sp.get('to');
  const q = sp.get('q')?.trim();
  const hasFilter = Boolean(group || status || restaurantId || from || to || q);
  const limit = Math.min(Number(sp.get('limit')) || (hasFilter ? 60 : 30), 200);

  const params: Record<string, string> = {
    select: 'id,order_code,status,total,created_at,restaurant_id,customer_id',
    order: 'created_at.desc',
    limit: String(limit),
  };

  // กรองตามกลุ่มสถานะ หรือสถานะเดี่ยว/หลายสถานะ
  if (group && GROUPS[group]) {
    params.status = `in.(${GROUPS[group].join(',')})`;
  } else if (status) {
    const list = status.split(',').map((s) => s.trim()).filter(Boolean);
    if (list.length) params.status = `in.(${list.join(',')})`;
  }
  // กรองเฉพาะร้าน (คีย์เดิมจากเวอร์ชันก่อน — แดชบอร์ดร้านใช้ต่อ)
  if (restaurantId) params['restaurant_id'] = `eq.${restaurantId}`;
  // กรองช่วงวันที่ (วันที่ไทย YYYY-MM-DD → ช่วงเวลา +07:00)
  // ระบุทั้ง from+to ต้องใช้ and=(created_at.gte...,created_at.lte...) — คอมมาในคีย์เดียว PostgREST ไม่รองรับ
  if (from && to) {
    params['and'] = `(created_at.gte.${from}T00:00:00+07:00,created_at.lte.${to}T23:59:59+07:00)`;
  } else if (from) {
    params['created_at'] = `gte.${from}T00:00:00+07:00`;
  } else if (to) {
    params['created_at'] = `lte.${to}T23:59:59+07:00`;
  }
  // ค้นหาด้วยรหัสออเดอร์
  if (q) params['order_code'] = `ilike.*${q}*`;

  const orders = await sbList<OrderRow>('orders', params);

  // ตารางชื่อร้าน/ชื่อลูกค้า
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
      restaurant_name: restaurants.find((r) => r.id === o.restaurant_id)?.name ?? '-',
      customer_name: customers.find((c) => c.id === o.customer_id)?.full_name ?? '-',
      // คีย์เดิม (camelCase) คงไว้ให้แดชบอร์ดเดิมใช้ต่อ
      restaurantName: restaurants.find((r) => r.id === o.restaurant_id)?.name ?? '-',
      customerName: customers.find((c) => c.id === o.customer_id)?.full_name ?? '-',
    })),
  });
}
