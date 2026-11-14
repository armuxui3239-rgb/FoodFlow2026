import { NextRequest } from 'next/server';
import { requireRole, getOwnerRestaurant } from '@/lib/portal';
import { sbList, sbOne, sbUpdate } from '@/lib/supabase';
import { jsonError } from '@/lib/api-user';

interface ProfileRow {
  id: string;
  user_id: string;
  staff_role: string;
  is_active: boolean;
  joined_at: string;
}

interface UserRow {
  id: string;
  full_name: string;
  email: string;
}

/** GET /api/owner/staff — พนักงานทั้งหมดที่ผูกกับร้านฉัน พร้อมชื่อ/อีเมลจาก users */
export async function GET(_req: NextRequest) {
  const user = await requireRole('restaurant');
  if (!user) return jsonError('เฉพาะเจ้าของร้านเท่านั้น', 403);
  const owner = await getOwnerRestaurant(user.id);
  if (!owner) return jsonError('บัญชีนี้ยังไม่ผูกกับร้านอาหาร', 404);

  const profiles = await sbList<ProfileRow>('restaurant_profiles', {
    restaurant_id: `eq.${owner.restaurantId}`,
    select: 'id,user_id,staff_role,is_active,joined_at',
    order: 'joined_at.asc',
    limit: '100',
  });

  const userIds = [...new Set(profiles.map((p) => p.user_id))];
  const users =
    userIds.length > 0
      ? await sbList<UserRow>('users', {
          id: `in.(${userIds.join(',')})`,
          select: 'id,full_name,email',
        })
      : [];
  const userById = new Map(users.map((u) => [u.id, u]));

  return Response.json({
    data: profiles.map((p) => ({
      id: p.id,
      userId: p.user_id,
      staffRole: p.staff_role,
      isActive: p.is_active,
      joinedAt: p.joined_at,
      name: userById.get(p.user_id)?.full_name?.trim() || 'สมาชิกร้าน',
      email: userById.get(p.user_id)?.email ?? '',
    })),
    currentUserId: user.id,
  });
}

/** PATCH /api/owner/staff — เปิด/ปิดการใช้งานพนักงาน { profileId, isActive } (ห้ามปิดบัญชีตัวเอง) */
export async function PATCH(req: NextRequest) {
  const user = await requireRole('restaurant');
  if (!user) return jsonError('เฉพาะเจ้าของร้านเท่านั้น', 403);
  const owner = await getOwnerRestaurant(user.id);
  if (!owner) return jsonError('บัญชีนี้ยังไม่ผูกกับร้านอาหาร', 404);

  const { profileId, isActive } = (await req.json().catch(() => ({}))) as {
    profileId?: string;
    isActive?: boolean;
  };
  if (!profileId || typeof isActive !== 'boolean') {
    return jsonError('กรุณาระบุ profileId และ isActive', 400);
  }

  const profile = await sbOne<{ id: string; user_id: string }>('restaurant_profiles', {
    id: `eq.${profileId}`,
    restaurant_id: `eq.${owner.restaurantId}`,
    select: 'id,user_id',
  });
  if (!profile) return jsonError('ไม่พบพนักงานคนนี้ในร้านของคุณ', 404);
  if (!isActive && profile.user_id === user.id) {
    return jsonError('ไม่สามารถปิดการใช้งานบัญชีของตัวเองได้', 400);
  }

  const [updated] = await sbUpdate<{ id: string; is_active: boolean }>(
    'restaurant_profiles',
    { id: `eq.${profileId}` },
    { is_active: isActive },
  );
  return Response.json({ ok: true, isActive: updated?.is_active ?? isActive });
}
