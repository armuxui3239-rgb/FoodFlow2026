import { NextRequest } from 'next/server';
import { sbDelete, sbInsert, sbList, sbOne } from '@/lib/supabase';
import { currentUser, jsonError } from '@/lib/api-user';

export interface FavoriteRestaurant {
  id: string;
  name: string;
  logo_url: string | null;
  cover_url: string | null;
  rating: number | null;
  cuisine_types: string[] | null;
  is_open: boolean;
  address_line: string | null;
}

export interface FavoriteRow {
  id: string;
  restaurant_id: string;
  created_at: string;
  restaurants: FavoriteRestaurant | null;
}

const SELECT =
  'id,restaurant_id,created_at,restaurants(id,name,logo_url,cover_url,rating,cuisine_types,is_open,address_line)';

/** GET — รายการร้านโปรดของผู้ใช้ + ข้อมูลร้าน (เรียงเพิ่มล่าสุดก่อน) */
export async function GET() {
  const user = await currentUser();
  if (!user) return jsonError('กรุณาเข้าสู่ระบบ', 401);

  const rows = await sbList<FavoriteRow>('favorite_restaurants', {
    user_id: `eq.${user.id}`,
    select: SELECT,
    order: 'created_at.desc',
  });
  return Response.json({ data: rows });
}

/** POST — เพิ่มร้านเข้ารายการโปรด (ถ้ามีอยู่แล้วคืน 409) */
export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user) return jsonError('กรุณาเข้าสู่ระบบ', 401);

  const { restaurantId } = (await req.json().catch(() => ({}))) as { restaurantId?: string };
  if (!restaurantId || typeof restaurantId !== 'string') return jsonError('กรุณาระบุร้านอาหาร', 400);

  const existing = await sbOne<{ id: string }>('favorite_restaurants', {
    user_id: `eq.${user.id}`,
    restaurant_id: `eq.${restaurantId}`,
    select: 'id',
  });
  if (existing) return jsonError('มีร้านนี้ในรายการโปรดแล้ว', 409);

  const now = new Date().toISOString();
  const [row] = await sbInsert<FavoriteRow>('favorite_restaurants', {
    user_id: user.id,
    restaurant_id: restaurantId,
    created_at: now,
  });
  return Response.json({ data: row });
}

/** DELETE — เอาร้านออกจากรายการโปรดของผู้ใช้นี้เท่านั้น (?restaurantId=) */
export async function DELETE(req: NextRequest) {
  const user = await currentUser();
  if (!user) return jsonError('กรุณาเข้าสู่ระบบ', 401);

  const restaurantId = req.nextUrl.searchParams.get('restaurantId');
  if (!restaurantId) return jsonError('กรุณาระบุร้านอาหาร', 400);

  await sbDelete('favorite_restaurants', {
    user_id: `eq.${user.id}`,
    restaurant_id: `eq.${restaurantId}`,
  });
  return Response.json({ data: { restaurantId } });
}
