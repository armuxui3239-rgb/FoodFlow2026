import { NextRequest } from 'next/server';
import { requireRole, getOwnerRestaurant } from '@/lib/portal';
import { sbOne, sbUpdate } from '@/lib/supabase';
import { jsonError } from '@/lib/api-user';

interface RestaurantProfileRow {
  name: string;
  description: string | null;
  cuisine_types: string[] | null;
  price_range: string;
  address_line: string | null;
  city: string | null;
  district: string | null;
  phone: string | null;
  logo_url: string | null;
  cover_url: string | null;
}

/** GET /api/owner/settings/profile — ข้อมูลโปรไฟล์ร้าน (ชื่อ/คำอธิบาย/ประเภทอาหาร/ที่อยู่/รูป) */
export async function GET(_req: NextRequest) {
  const user = await requireRole('restaurant');
  if (!user) return jsonError('เฉพาะเจ้าของร้านเท่านั้น', 403);
  const owner = await getOwnerRestaurant(user.id);
  if (!owner) return jsonError('บัญชีนี้ยังไม่ผูกกับร้านอาหาร', 404);

  const rst = await sbOne<RestaurantProfileRow>('restaurants', {
    id: `eq.${owner.restaurantId}`,
    select: 'name,description,cuisine_types,price_range,address_line,city,district,phone,logo_url,cover_url',
  });
  if (!rst) return jsonError('ไม่พบร้านของคุณ', 404);
  return Response.json({ data: rst });
}

/**
 * PATCH /api/owner/settings/profile — แก้โปรไฟล์ร้าน
 * body: { name?, description?, cuisineTypes? (ข้อความคั่นด้วยจุลภาค → เก็บเป็น array), priceRange? ($ $$ $$$), addressLine?, city?, district?, phone?, logoUrl?, coverUrl? }
 */
export async function PATCH(req: NextRequest) {
  const user = await requireRole('restaurant');
  if (!user) return jsonError('เฉพาะเจ้าของร้านเท่านั้น', 403);
  const owner = await getOwnerRestaurant(user.id);
  if (!owner) return jsonError('บัญชีนี้ยังไม่ผูกกับร้านอาหาร', 404);

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const patch: Record<string, unknown> = {};

  if (body.name !== undefined) {
    const name = String(body.name).trim();
    if (!name) return jsonError('กรุณากรอกชื่อร้าน', 400);
    patch.name = name;
  }
  if (body.description !== undefined) patch.description = String(body.description).trim() || null;

  if (body.cuisineTypes !== undefined) {
    const types = String(body.cuisineTypes)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    patch.cuisine_types = types;
  }
  if (body.priceRange !== undefined) {
    const pr = String(body.priceRange);
    if (!['$', '$$', '$$$'].includes(pr)) return jsonError('ช่วงราคาต้องเป็น $, $$ หรือ $$$ เท่านั้น', 400);
    patch.price_range = pr;
  }
  if (body.addressLine !== undefined) patch.address_line = String(body.addressLine).trim() || null;
  if (body.city !== undefined) patch.city = String(body.city).trim() || null;
  if (body.district !== undefined) patch.district = String(body.district).trim() || null;
  if (body.phone !== undefined) patch.phone = String(body.phone).trim() || null;
  if (body.logoUrl !== undefined) patch.logo_url = String(body.logoUrl).trim() || null;
  if (body.coverUrl !== undefined) patch.cover_url = String(body.coverUrl).trim() || null;

  if (Object.keys(patch).length === 0) return jsonError('ไม่มีข้อมูลที่ต้องการแก้ไข', 400);

  await sbUpdate('restaurants', { id: `eq.${owner.restaurantId}` }, patch);
  return Response.json({ ok: true });
}
