import { NextRequest } from 'next/server';
import { requireRole, getOwnerRestaurant } from '@/lib/portal';
import { sbList, sbOne, sbUpdate } from '@/lib/supabase';
import { jsonError } from '@/lib/api-user';

interface HourRow {
  id: string;
  day_of_week: number;
  open_time: string | null;
  close_time: string | null;
  is_closed: boolean;
}

/** GET /api/owner/settings — ข้อมูลร้าน + เวลาเปิด 7 วัน */
export async function GET(_req: NextRequest) {
  const user = await requireRole('restaurant');
  if (!user) return jsonError('เฉพาะเจ้าของร้านเท่านั้น', 403);
  const owner = await getOwnerRestaurant(user.id);
  if (!owner) return jsonError('บัญชีนี้ยังไม่ผูกกับร้านอาหาร', 404);

  const rst = await sbOne<{
    id: string;
    name: string;
    phone: string | null;
    min_order_amount: number | null;
    is_open: boolean;
    prep_time_avg_minutes: number | null;
    address_line: string | null;
  }>('restaurants', {
    id: `eq.${owner.restaurantId}`,
    select: 'id,name,phone,min_order_amount,is_open,prep_time_avg_minutes,address_line',
  });
  if (!rst) return jsonError('ไม่พบร้านของคุณ', 404);
  const hours = await sbList<HourRow>('restaurant_opening_hours', {
    restaurant_id: `eq.${owner.restaurantId}`,
    select: 'id,day_of_week,open_time,close_time,is_closed',
    order: 'day_of_week.asc',
    limit: '10',
  });
  return Response.json({ restaurant: rst, hours });
}

/**
 * PATCH /api/owner/settings — แก้ข้อมูลร้าน
 * { isOpen?, minOrderBaht?, phone?, prepMinutes?, hours?: [{dayOfWeek, opensAt, closesAt, isClosed}] }
 * เงินรับเป็น "บาท" จากฟอร์ม แปลงเป็นสตางค์ก่อนเก็บ (มาตรฐานฐานข้อมูล)
 */
export async function PATCH(req: NextRequest) {
  const user = await requireRole('restaurant');
  if (!user) return jsonError('เฉพาะเจ้าของร้านเท่านั้น', 403);
  const owner = await getOwnerRestaurant(user.id);
  if (!owner) return jsonError('บัญชีนี้ยังไม่ผูกกับร้านอาหาร', 404);

  const body = (await req.json().catch(() => ({}))) as {
    isOpen?: boolean;
    minOrderBaht?: number;
    phone?: string;
    prepMinutes?: number;
    hours?: { dayOfWeek: number; opensAt: string; closesAt: string; isClosed: boolean }[];
  };

  const patch: Record<string, unknown> = {};
  if (typeof body.isOpen === 'boolean') patch.is_open = body.isOpen;
  if (typeof body.minOrderBaht === 'number' && body.minOrderBaht >= 0) {
    patch.min_order_amount = Math.round(body.minOrderBaht * 100);
  }
  if (typeof body.phone === 'string' && body.phone.trim() !== '') patch.phone = body.phone.trim();
  if (typeof body.prepMinutes === 'number' && body.prepMinutes > 0 && body.prepMinutes <= 180) {
    patch.prep_time_avg_minutes = Math.round(body.prepMinutes);
  }
  if (Object.keys(patch).length > 0) {
    await sbUpdate('restaurants', { id: `eq.${owner.restaurantId}` }, patch);
  }

  // เวลาเปิดรายวัน
  if (Array.isArray(body.hours)) {
    for (const h of body.hours) {
      if (typeof h.dayOfWeek !== 'number' || h.dayOfWeek < 0 || h.dayOfWeek > 6) continue;
      await sbUpdate('restaurant_opening_hours', {
        restaurant_id: `eq.${owner.restaurantId}`,
        day_of_week: `eq.${h.dayOfWeek}`,
      }, {
        open_time: h.isClosed ? null : h.opensAt,
        close_time: h.isClosed ? null : h.closesAt,
        is_closed: h.isClosed,
      });
    }
  }

  return Response.json({ ok: true });
}
