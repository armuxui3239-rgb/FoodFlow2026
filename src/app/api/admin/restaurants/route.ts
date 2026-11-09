import { NextRequest } from 'next/server';
import { requireRole } from '@/lib/portal';
import { sbList } from '@/lib/supabase';
import { jsonError } from '@/lib/api-user';

/** GET /api/admin/restaurants — ร้านทั้งหมด + เจ้าของ + สถานะ */
export async function GET(_req: NextRequest) {
  const user = await requireRole('admin');
  if (!user) return jsonError('เฉพาะผู้ดูแลระบบเท่านั้น', 403);

  const restaurants = await sbList<{
    id: string;
    name: string;
    slug: string;
    is_open: boolean;
    is_active: boolean;
    approval_status: string;
    rating: number | null;
    total_reviews: number | null;
  }>('restaurants', {
    select: 'id,name,slug,is_open,is_active,approval_status,rating,total_reviews',
    order: 'name.asc',
    limit: '200',
  });

  const rstIds = restaurants.map((r) => r.id);
  const profiles = rstIds.length
    ? await sbList<{ restaurant_id: string; user_id: string; is_active: boolean }>('restaurant_profiles', {
        restaurant_id: `in.(${rstIds.join(',')})`,
        is_active: 'eq.true',
        select: 'restaurant_id,user_id,is_active',
        limit: '300',
      })
    : [];
  const ownerIds = [...new Set(profiles.map((p) => p.user_id))];
  const owners = ownerIds.length
    ? await sbList<{ id: string; email: string; full_name: string }>('users', {
        id: `in.(${ownerIds.join(',')})`,
        select: 'id,email,full_name',
        limit: '300',
      })
    : [];

  return Response.json({
    data: restaurants.map((r) => {
      const p = profiles.find((x) => x.restaurant_id === r.id);
      const o = p ? owners.find((x) => x.id === p.user_id) : null;
      return { ...r, ownerEmail: o?.email ?? null, ownerName: o?.full_name ?? null };
    }),
  });
}
