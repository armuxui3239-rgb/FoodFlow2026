import crypto from 'crypto';
import { NextRequest } from 'next/server';
import { requireRole, getOwnerRestaurant } from '@/lib/portal';
import { sbList, sbInsert } from '@/lib/supabase';
import { jsonError } from '@/lib/api-user';

interface ShiftRow {
  id: string;
  restaurant_profile_id: string;
  starts_at: string;
  ends_at: string;
  status: string;
  note: string | null;
}

/** GET /api/owner/shifts — เวรทำงานของร้าน (ใหม่ก่อน) พร้อมชื่อพนักงาน (D4) */
export async function GET(_req: NextRequest) {
  const user = await requireRole('restaurant');
  if (!user) return jsonError('เฉพาะเจ้าของร้านเท่านั้น', 403);
  const owner = await getOwnerRestaurant(user.id);
  if (!owner) return jsonError('บัญชีนี้ยังไม่ผูกกับร้านอาหาร', 404);

  const shifts = await sbList<ShiftRow>('staff_shifts', {
    restaurant_id: `eq.${owner.restaurantId}`,
    order: 'starts_at.desc',
    limit: '100',
    select: 'id,restaurant_profile_id,starts_at,ends_at,status,note',
  });

  const profiles = await sbList<{ id: string; full_name: string | null }>(
    'restaurant_profiles',
    // embed users ผ่าน restaurant_profiles — ใช้ชื่อคอลัมน์ user_id
    {
      restaurant_id: `eq.${owner.restaurantId}`,
      select: 'id,users(full_name)',
      limit: '100',
    },
  );
  const nameById = new Map(profiles.map((p) => [p.id, (p as { users?: { full_name: string | null } }).users?.full_name ?? 'พนักงาน']));

  const data = shifts.map((s) => ({
    ...s,
    staffName: nameById.get(s.restaurant_profile_id) ?? 'พนักงาน',
  }));
  return Response.json({ data });
}

/** POST /api/owner/shifts — สร้างเวร body: { restaurantProfileId, startsAt, endsAt, note? } */
export async function POST(req: NextRequest) {
  const user = await requireRole('restaurant');
  if (!user) return jsonError('เฉพาะเจ้าของร้านเท่านั้น', 403);
  const owner = await getOwnerRestaurant(user.id);
  if (!owner) return jsonError('บัญชีนี้ยังไม่ผูกกับร้านอาหาร', 404);

  const { restaurantProfileId, startsAt, endsAt, note } = (await req.json().catch(() => ({}))) as {
    restaurantProfileId?: string;
    startsAt?: string;
    endsAt?: string;
    note?: string;
  };
  if (!restaurantProfileId || !startsAt || !endsAt) {
    return jsonError('กรุณาระบุพนักงานและช่วงเวลาเวร', 400);
  }
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
    return jsonError('ช่วงเวลาเวรไม่ถูกต้อง (เวลาสิ้นสุดต้องหลังเริ่ม)', 400);
  }

  // พนักงานต้องเป็นทีมร้านนี้จริง
  const profile = await sbList<{ id: string }>('restaurant_profiles', {
    id: `eq.${restaurantProfileId}`,
    restaurant_id: `eq.${owner.restaurantId}`,
    is_active: 'eq.true',
    select: 'id',
    limit: '1',
  });
  if (!profile.length) return jsonError('ไม่พบพนักงานคนนี้ในร้านของคุณ', 404);

  // กันเวรทับซ้อนของพนักงานคนเดียวกัน (scheduled เท่านั้น)
  const overlapping = await sbList<{ id: string }>('staff_shifts', {
    restaurant_profile_id: `eq.${restaurantProfileId}`,
    status: 'eq.scheduled',
    starts_at: `lt.${end.toISOString()}`,
    ends_at: `gt.${start.toISOString()}`,
    select: 'id',
    limit: '1',
  });
  if (overlapping.length) return jsonError('พนักงานคนนี้มีเวรทับช่วงเวลานี้อยู่แล้ว', 409);

  const [row] = await sbInsert<{ id: string; status: string }>('staff_shifts', {
    id: crypto.randomUUID(),
    restaurant_id: owner.restaurantId,
    restaurant_profile_id: restaurantProfileId,
    starts_at: start.toISOString(),
    ends_at: end.toISOString(),
    status: 'scheduled',
    note: note?.trim() || null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  return Response.json({ data: row }, { status: 201 });
}
