import { NextRequest } from 'next/server';
import { requireRole } from '@/lib/portal';
import { sbList } from '@/lib/supabase';
import { decodeWkbPoint } from '@/lib/geo';
import { jsonError } from '@/lib/api-user';

interface HeatItem {
  restaurantId: string;
  name: string;
  lat: number;
  lng: number;
  orderCount: number;
}

/** GET /api/driver/heatmap — ความต้องการจัดส่งตามร้าน (จำนวนออเดอร์สำเร็จ 7 วันล่าสุด) */
export async function GET(_req: NextRequest) {
  const user = await requireRole('driver');
  if (!user) return jsonError('เฉพาะไรเดอร์เท่านั้น', 403);

  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // ร้านที่เปิดใช้งาน + มีพิกัด (geography hex EWKB)
  const restaurants = await sbList<{ id: string; name: string; location: string }>('restaurants', {
    is_active: 'eq.true',
    select: 'id,name,location',
    limit: '200',
  });

  // นับออเดอร์สำเร็จ 7 วันล่าสุดต่อร้าน (รวมฝั่ง route เพราะ Supabase REST นับกลุ่มไม่ได้ตรงนี้)
  const orders = await sbList<{ restaurant_id: string }>('orders', {
    status: 'in.(delivered,completed)',
    created_at: `gte.${since}`,
    select: 'restaurant_id',
    limit: '1000',
  });
  const counts = new Map<string, number>();
  for (const o of orders) {
    counts.set(o.restaurant_id, (counts.get(o.restaurant_id) ?? 0) + 1);
  }

  const items: HeatItem[] = restaurants
    .map((r) => {
      const coords = decodeWkbPoint(r.location);
      if (!coords) return null; // ไม่มีพิกัด — ข้าม
      return {
        restaurantId: r.id,
        name: r.name,
        lat: coords[1],
        lng: coords[0],
        orderCount: counts.get(r.id) ?? 0,
      };
    })
    .filter((x): x is HeatItem => x !== null)
    .sort((a, b) => b.orderCount - a.orderCount)
    .slice(0, 50);

  return Response.json(items, { headers: { 'Cache-Control': 'no-store' } });
}
