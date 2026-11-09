import { NextRequest } from 'next/server';
import { requireRole } from '@/lib/portal';
import { decodeWkbPoint } from '@/lib/geo';
import { sbOne, sbList } from '@/lib/supabase';
import { jsonError } from '@/lib/api-user';

/** GET /api/orders/[id]/map — พิกัดร้าน/จุดส่ง/ไรเดอร์ สำหรับหน้าแผนที่ (เจ้าของออเดอร์เท่านั้น) */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await requireRole('customer', 'restaurant', 'driver', 'admin');
  if (!user) return jsonError('กรุณาเข้าสู่ระบบ', 401);
  const { id } = await ctx.params;

  const order = await sbOne<{
    id: string;
    status: string;
    restaurant_id: string;
    delivery_address_id: string | null;
    driver_id: string | null;
    customer_id: string;
    order_code: string;
  }>('orders', {
    id: `eq.${id}`,
    select: 'id,status,restaurant_id,delivery_address_id,driver_id,customer_id,order_code',
  });
  if (!order) return jsonError('ไม่พบคำสั่งซื้อ', 404);

  // ผู้มีสิทธิ์ดู: เจ้าของออเดอร์ / ไรเดอร์ผู้รับงาน (แอดมินดูได้ทุกใบ)
  const allowed =
    user.role === 'admin' || order.customer_id === user.id || (user.role === 'driver' && order.driver_id === user.id);
  if (!allowed) return jsonError('ไม่มีสิทธิ์ดูคำสั่งซื้อนี้', 403);

  const restaurant = await sbOne<{ name: string; location: string; address_line: string | null }>('restaurants', {
    id: `eq.${order.restaurant_id}`,
    select: 'name,location,address_line',
  });
  const address = order.delivery_address_id
    ? await sbOne<{ address_line: string; location: string }>('addresses', {
        id: `eq.${order.delivery_address_id}`,
        select: 'address_line,location',
      })
    : null;

  let driver: { name: string; lat: number | null; lng: number | null } | null = null;
  if (order.driver_id) {
    const prof = await sbOne<{ current_lat: number | null; current_lng: number | null }>('driver_profiles', {
      user_id: `eq.${order.driver_id}`,
      select: 'current_lat,current_lng',
    });
    if (prof) {
      const du = await sbList<{ full_name: string }>('users', {
        id: `eq.${order.driver_id}`,
        select: 'full_name',
        limit: '1',
      });
      driver = { name: du[0]?.full_name ?? 'ไรเดอร์', lat: prof.current_lat, lng: prof.current_lng };
    }
  }

  return Response.json({
    order: { id: order.id, code: order.order_code, status: order.status },
    restaurant: {
      name: restaurant?.name ?? 'ร้านอาหาร',
      address: restaurant?.address_line ?? '',
      coords: decodeWkbPoint(restaurant?.location),
    },
    dropoff: {
      address: address?.address_line ?? '',
      coords: decodeWkbPoint(address?.location),
    },
    driver,
  });
}
