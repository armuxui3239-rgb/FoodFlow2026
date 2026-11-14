import 'server-only';
import crypto from 'crypto';
import { sbList, sbOne, sbUpdate, sbInsert } from '@/lib/supabase';
import { decodeWkbPoint, haversineKm } from '@/lib/geo';

/** ระบบเสนองานอัตโนมัติ (REMAINING-WORK D3 / v4 ข้อ 3)
 *  โมเดลตามแม่แบบ: unique index "dispatch_offers_one_active_per_order_idx" = เสนอทีละคน
 *  ร้านกด "พร้อมส่ง" → เสนอให้ไรเดอร์ออนไลน์**ที่ใกล้ที่สุด**คนแรก (อายุ 2 นาที)
 *  หมดอายุ/ปฏิเสธ → เสนอให้คนใกล้คนถัดไปอัตโนมัติ (lazy — ระบบไม่มี cron)
 *  จนหมดผู้สมัคร → งานกลับไปอยู่ในกองสาธารณะ (ผ่าน /api/driver/tasks) ตามเดิม */

export const DISPATCH_OFFER_TTL_SEC = 120;

interface DriverCandidate {
  user_id: string;
  rating: number;
  total_deliveries: number;
  km: number;
}

/** ยกเลิกข้อเสนอที่หมดอายุแล้ว (lazy — เรียกก่อนอ่าน/สร้างเสมอ) แล้วเลื่อนไปเสนอคนถัดไป */
export async function expireStaleOffers(): Promise<void> {
  const stale = await sbList<{ id: string; order_id: string }>('dispatch_offers', {
    status: 'eq.pending',
    expires_at: `lt.${new Date().toISOString()}`,
    select: 'id,order_id',
    limit: '100',
  });
  if (stale.length === 0) return;
  await sbUpdate(
    'dispatch_offers',
    { status: 'eq.pending', expires_at: `lt.${new Date().toISOString()}` },
    { status: 'expired', updated_at: new Date().toISOString() },
  );
  for (const orderId of [...new Set(stale.map((s) => s.order_id))]) {
    await offerNextDriver(orderId).catch((e) => console.error('dispatch advance error:', e));
  }
}

/** เสนองานให้ไรเดอร์ที่ใกล้ที่สุดที่ยังไม่เคยถูกเสนอในออเดอร์นี้ (คืน 1 ถ้าสร้างได้ / 0 ถ้าไม่มีผู้สมัคร) */
export async function offerNextDriver(orderId: string): Promise<number> {
  const order = await sbOne<{ driver_id: string | null; status: string; restaurant_id: string }>('orders', {
    id: `eq.${orderId}`,
    select: 'driver_id,status,restaurant_id',
  });
  if (!order || order.driver_id || order.status !== 'ready_for_pickup') return 0;

  // มีข้อเสนอ active ค้างอยู่? (unique index บังคับ 1 active ต่อออเดอร์)
  const active = await sbList<{ id: string }>('dispatch_offers', {
    order_id: `eq.${orderId}`,
    status: 'in.(pending,accepted)',
    select: 'id',
    limit: '1',
  });
  if (active.length > 0) return 0;

  const rst = await sbOne<{ location: string }>('restaurants', {
    id: `eq.${order.restaurant_id}`,
    select: 'location',
  });
  const from = decodeWkbPoint(rst?.location ?? null);
  if (!from) return 0;

  const profiles = await sbList<{
    user_id: string;
    rating: number;
    total_deliveries: number;
    current_lat: number | null;
    current_lng: number | null;
  }>('driver_profiles', {
    is_online: 'eq.true',
    select: 'user_id,rating,total_deliveries,current_lat,current_lng',
    limit: '100',
  });
  const withGps = profiles.filter((p) => p.current_lat != null && p.current_lng != null);
  if (withGps.length === 0) return 0;

  // ตัดคนที่เคยถูกเสนอในออเดอร์นี้ออก (ไม่ว่าผลจะเป็นอย่างไร) — ไม่เสนอซ้ำคนเดิม
  const tried = new Set(
    (
      await sbList<{ driver_id: string }>('dispatch_offers', {
        order_id: `eq.${orderId}`,
        select: 'driver_id',
        limit: '200',
      })
    ).map((x) => x.driver_id),
  );

  const candidates: DriverCandidate[] = withGps
    .filter((p) => !tried.has(p.user_id))
    .map((p) => ({
      user_id: p.user_id,
      rating: p.rating,
      total_deliveries: p.total_deliveries,
      km: haversineKm(from, [p.current_lng as number, p.current_lat as number]),
    }))
    .sort((a, b) => a.km - b.km);
  if (candidates.length === 0) return 0;

  const pick = candidates[0];
  const priorCount = (
    await sbList<{ id: string }>('dispatch_offers', {
      order_id: `eq.${orderId}`,
      select: 'id',
      limit: '200',
    })
  ).length;
  const nowIso = new Date().toISOString();

  await sbInsert('dispatch_offers', {
    id: crypto.randomUUID(),
    order_id: orderId,
    driver_id: pick.user_id,
    token_hash: crypto.createHash('sha256').update(`${orderId}:${pick.user_id}:${crypto.randomUUID()}`).digest('hex'),
    status: 'pending',
    attempt: priorCount + 1,
    restaurant_lat: from[1],
    restaurant_lng: from[0],
    distance_km: Math.round(pick.km * 10) / 10,
    driver_rating: pick.rating,
    total_deliveries: pick.total_deliveries,
    surge_multiplier: 1,
    expires_at: new Date(Date.now() + DISPATCH_OFFER_TTL_SEC * 1000).toISOString(),
    created_at: nowIso,
    updated_at: nowIso,
  });
  return 1;
}

/** เรียกตอนร้านกด "พร้อมส่ง" — เริ่มรอบเสนองาน (คืน 1 เมื่อสร้างข้อเสนอแรกได้) */
export async function dispatchOrderToDrivers(orderId: string): Promise<number> {
  await expireStaleOffers();
  return offerNextDriver(orderId);
}
