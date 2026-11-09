import { NextRequest } from 'next/server';
import { requireRole } from '@/lib/portal';
import { sbOne, sbUpdate } from '@/lib/supabase';
import { jsonError } from '@/lib/api-user';

interface DriverProfile {
  id: string;
  user_id: string;
  vehicle_type: string;
  vehicle_plate: string;
  is_online: boolean;
  rating: number | null;
  total_deliveries: number | null;
  total_earnings: number | null;
}

/** GET /api/driver/me — โปรไฟล์ไรเดอร์ + สถิติ */
export async function GET(_req: NextRequest) {
  const user = await requireRole('driver');
  if (!user) return jsonError('เฉพาะไรเดอร์เท่านั้น', 403);
  const profile = await sbOne<DriverProfile>('driver_profiles', {
    user_id: `eq.${user.id}`,
    select: 'id,user_id,vehicle_type,vehicle_plate,is_online,rating,total_deliveries,total_earnings',
  });
  if (!profile) return jsonError('ยังไม่มีโปรไฟล์ไรเดอร์สำหรับบัญชีนี้', 404);
  return Response.json({ driver: profile, fullName: user.fullName });
}

/** PATCH /api/driver/me — เปิด/ปิดรับงาน { isOnline } */
export async function PATCH(req: NextRequest) {
  const user = await requireRole('driver');
  if (!user) return jsonError('เฉพาะไรเดอร์เท่านั้น', 403);
  const { isOnline } = (await req.json().catch(() => ({}))) as { isOnline?: boolean };
  if (typeof isOnline !== 'boolean') return jsonError('กรุณาระบุ isOnline', 400);
  const [updated] = await sbUpdate<{ id: string; is_online: boolean }>(
    'driver_profiles',
    { user_id: `eq.${user.id}` },
    { is_online: isOnline },
  );
  if (!updated) return jsonError('ยังไม่มีโปรไฟล์ไรเดอร์สำหรับบัญชีนี้', 404);
  return Response.json({ ok: true, isOnline: updated.is_online });
}
