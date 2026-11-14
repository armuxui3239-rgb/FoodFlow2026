import { NextRequest } from 'next/server';
import { requireRole } from '@/lib/portal';
import { sbList } from '@/lib/supabase';
import { jsonError } from '@/lib/api-user';

interface DriverProfileRow {
  id: string;
  user_id: string;
  vehicle_type: string;
  vehicle_plate: string | null;
  current_lat: number;
  current_lng: number;
}

interface UserRow {
  id: string;
  full_name: string;
}

/** GET /api/admin/drivers/map — ไรเดอร์ออนไลน์ที่มีพิกัดล่าสุด สำหรับปักหมุดบนแผนที่ */
export async function GET(_req: NextRequest) {
  const user = await requireRole('admin');
  if (!user) return jsonError('เฉพาะผู้ดูแลระบบเท่านั้น', 403);

  const profiles = await sbList<DriverProfileRow>('driver_profiles', {
    is_online: 'eq.true',
    current_lat: 'not.is.null',
    current_lng: 'not.is.null',
    select: 'id,user_id,vehicle_type,vehicle_plate,current_lat,current_lng',
    limit: '500',
  });

  const ids = [...new Set(profiles.map((p) => p.user_id))];
  const users = ids.length
    ? await sbList<UserRow>('users', {
        id: `in.(${ids.join(',')})`,
        select: 'id,full_name',
        limit: '500',
      })
    : [];

  const data = profiles.map((p) => ({
    id: p.id,
    name: users.find((u) => u.id === p.user_id)?.full_name ?? 'ไรเดอร์',
    vehicleType: p.vehicle_type,
    plate: p.vehicle_plate,
    lat: p.current_lat,
    lng: p.current_lng,
  }));

  return Response.json({ data });
}
