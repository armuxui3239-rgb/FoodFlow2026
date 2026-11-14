import { NextRequest } from 'next/server';
import { requireRole } from '@/lib/portal';
import { sbOne, sbUpdate } from '@/lib/supabase';
import { jsonError } from '@/lib/api-user';

interface ProfileRow {
  id: string;
  user_id: string;
  license_number: string | null;
  vehicle_type: string;
  vehicle_plate: string | null;
  is_online: boolean;
  is_verified: boolean;
  rating: number | null;
  total_deliveries: number | null;
  total_earnings: number | null;
}

interface UserRow {
  id: string;
  email: string;
  phone: string | null;
  full_name: string;
  avatar_url: string | null;
}

/** GET /api/driver/profile — โปรไฟล์ไรเดอร์ของฉัน (driver_profiles + users) */
export async function GET(_req: NextRequest) {
  const user = await requireRole('driver');
  if (!user) return jsonError('เฉพาะไรเดอร์เท่านั้น', 403);

  const profile = await sbOne<ProfileRow>('driver_profiles', {
    user_id: `eq.${user.id}`,
    select: 'id,user_id,license_number,vehicle_type,vehicle_plate,is_online,is_verified,rating,total_deliveries,total_earnings',
  });
  if (!profile) return jsonError('ยังไม่มีโปรไฟล์ไรเดอร์สำหรับบัญชีนี้', 404);

  const me = await sbOne<UserRow>('users', {
    id: `eq.${user.id}`,
    select: 'id,email,phone,full_name,avatar_url',
  });

  return Response.json({ profile, user: me });
}

/** PATCH /api/driver/profile — สลับสถานะเปิด/ปิดรับงาน { is_online } */
export async function PATCH(req: NextRequest) {
  const user = await requireRole('driver');
  if (!user) return jsonError('เฉพาะไรเดอร์เท่านั้น', 403);

  const { is_online } = (await req.json().catch(() => ({}))) as { is_online?: boolean };
  if (typeof is_online !== 'boolean') return jsonError('กรุณาระบุ is_online', 400);

  const [updated] = await sbUpdate<{ id: string; is_online: boolean }>(
    'driver_profiles',
    { user_id: `eq.${user.id}` },
    { is_online },
  );
  if (!updated) return jsonError('ยังไม่มีโปรไฟล์ไรเดอร์สำหรับบัญชีนี้', 404);
  return Response.json({ ok: true, is_online: updated.is_online });
}
