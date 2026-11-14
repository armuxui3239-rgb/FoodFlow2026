import { NextRequest } from 'next/server';
import { requireRole } from '@/lib/portal';
import { sbList } from '@/lib/supabase';
import { jsonError } from '@/lib/api-user';

interface DriverProfileRow {
  id: string;
  user_id: string;
  license_number: string | null;
  vehicle_type: string;
  vehicle_plate: string | null;
  is_online: boolean;
  is_verified: boolean;
  rating: number | null;
  total_deliveries: number;
  total_earnings: number;
}

interface UserRow {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  is_active: boolean;
}

export interface AdminDriverRow extends DriverProfileRow {
  user: UserRow | null;
  accountActive: boolean;
}

/** GET /api/admin/drivers — ไรเดอร์ทุกคน เรียงตามคะแนน + สถิติรวม */
export async function GET(_req: NextRequest) {
  const user = await requireRole('admin');
  if (!user) return jsonError('เฉพาะผู้ดูแลระบบเท่านั้น', 403);

  const profiles = await sbList<DriverProfileRow>('driver_profiles', {
    select: 'id,user_id,license_number,vehicle_type,vehicle_plate,is_online,is_verified,rating,total_deliveries,total_earnings',
    order: 'rating.desc.nullslast',
    limit: '300',
  });

  const ids = [...new Set(profiles.map((p) => p.user_id))];
  const users = ids.length
    ? await sbList<UserRow>('users', {
        id: `in.(${ids.join(',')})`,
        select: 'id,full_name,email,phone,is_active',
        limit: '300',
      })
    : [];

  const data: AdminDriverRow[] = profiles.map((p) => {
    const u = users.find((x) => x.id === p.user_id) ?? null;
    return {
      ...p,
      user: u,
      accountActive: u?.is_active ?? false,
    };
  });

  const stats = {
    total: profiles.length,
    online: profiles.filter((p) => p.is_online).length,
    verified: profiles.filter((p) => p.is_verified).length,
  };

  return Response.json({ data, stats });
}
