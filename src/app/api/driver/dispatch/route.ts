import { NextRequest } from 'next/server';
import { requireRole } from '@/lib/portal';
import { expireStaleOffers } from '@/lib/dispatch';
import { sbList } from '@/lib/supabase';
import { jsonError } from '@/lib/api-user';

interface OfferRow {
  id: string;
  order_id: string;
  distance_km: number | null;
  expires_at: string;
  created_at: string;
  orders: {
    order_code: string;
    delivery_fee: number;
    restaurants: { name: string; address_line: string | null } | null;
  } | null;
}

/** GET /api/driver/dispatch — ข้อเสนองานที่ยังรอฉันตอบ (lazy ยกเลิกของหมดอายุก่อนเสมอ — ระบบไม่มี cron) */
export async function GET(_req: NextRequest) {
  const user = await requireRole('driver');
  if (!user) return jsonError('เฉพาะไรเดอร์เท่านั้น', 403);

  await expireStaleOffers();

  const offers = await sbList<OfferRow>('dispatch_offers', {
    driver_id: `eq.${user.id}`,
    status: 'eq.pending',
    expires_at: `gte.${new Date().toISOString()}`,
    order: 'created_at.asc',
    limit: '20',
    select:
      'id,order_id,distance_km,expires_at,created_at,orders(order_code,delivery_fee,restaurants(name,address_line))',
  });

  // ที่อยู่จุดส่งของแต่ละออเดอร์ (ผ่าน orders.delivery_address_id — สองขั้น)
  const oIds = [...new Set(offers.map((o) => o.order_id))];
  const orderAddr = oIds.length
    ? await sbList<{ id: string; delivery_address_id: string | null }>('orders', {
        id: `in.(${oIds.join(',')})`,
        select: 'id,delivery_address_id',
        limit: '50',
      })
    : [];
  const addrIds = orderAddr.map((x) => x.delivery_address_id).filter((x): x is string => !!x);
  const dropoffs = addrIds.length
    ? await sbList<{ id: string; address_line: string; label: string | null }>('addresses', {
        id: `in.(${addrIds.join(',')})`,
        select: 'id,address_line,label',
        limit: '100',
      })
    : [];

  const data = offers.map((o) => {
    const ord = o.orders ?? { order_code: '', delivery_fee: 0, restaurants: null };
    const addrId = orderAddr.find((x) => x.id === o.order_id)?.delivery_address_id;
    const drop = dropoffs.find((a) => a.id === addrId);
    return {
      id: o.id,
      orderId: o.order_id,
      orderCode: ord.order_code,
      restaurantName: ord.restaurants?.name ?? '',
      restaurantAddress: ord.restaurants?.address_line ?? '',
      dropoffAddress: drop?.address_line ?? '',
      dropoffLabel: drop?.label ?? '',
      deliveryFee: ord.delivery_fee ?? 0,
      distanceKm: o.distance_km,
      expiresAt: o.expires_at,
      expiresInSec: Math.max(0, Math.round((new Date(o.expires_at).getTime() - Date.now()) / 1000)),
      createdAt: o.created_at,
    };
  });

  return Response.json({ data });
}
