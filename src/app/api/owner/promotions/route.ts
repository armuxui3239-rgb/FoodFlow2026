import { NextRequest } from 'next/server';
import { requireRole, getOwnerRestaurant } from '@/lib/portal';
import { sbList, sbOne, sbInsert } from '@/lib/supabase';
import { jsonError } from '@/lib/api-user';

interface PromoRow {
  id: string;
  code: string;
  name: string;
  type: string;
  value: number;
  min_order_amount: number;
  max_discount: number | null;
  usage_limit: number;
  usage_count: number;
  expires_at: string;
  is_active: boolean;
  first_order_only: boolean;
  max_per_user: number | null;
  created_at: string;
}

/** GET /api/owner/promotions — คูปองของร้านฉันเท่านั้น */
export async function GET(_req: NextRequest) {
  const user = await requireRole('restaurant');
  if (!user) return jsonError('เฉพาะเจ้าของร้านเท่านั้น', 403);
  const owner = await getOwnerRestaurant(user.id);
  if (!owner) return jsonError('บัญชีนี้ยังไม่ผูกกับร้านอาหาร', 404);

  const promos = await sbList<PromoRow>('promotions', {
    restaurant_id: `eq.${owner.restaurantId}`,
    select: 'id,code,name,type,value,min_order_amount,max_discount,usage_limit,usage_count,expires_at,is_active,first_order_only,max_per_user,created_at',
    order: 'created_at.desc',
    limit: '100',
  });
  return Response.json({ data: promos });
}

/**
 * POST /api/owner/promotions — สร้างคูปองของร้าน
 * { code, name?, type: 'fixed'|'percentage', value, minOrderBaht?, maxDiscountBaht?, usageLimit?, maxPerUser?, firstOrderOnly?, expiresAt? }
 * ราคารับเป็นบาท เก็บเป็นสตางค์ตามมาตรฐานฐานข้อมูล
 */
export async function POST(req: NextRequest) {
  const user = await requireRole('restaurant');
  if (!user) return jsonError('เฉพาะเจ้าของร้านเท่านั้น', 403);
  const owner = await getOwnerRestaurant(user.id);
  if (!owner) return jsonError('บัญชีนี้ยังไม่ผูกกับร้านอาหาร', 404);

  const b = (await req.json().catch(() => ({}))) as {
    code?: string;
    name?: string;
    type?: string;
    value?: number;
    minOrderBaht?: number;
    maxDiscountBaht?: number | null;
    usageLimit?: number;
    maxPerUser?: number | null;
    firstOrderOnly?: boolean;
    expiresAt?: string | null;
  };
  const code = b.code?.trim().toUpperCase();
  if (!code) return jsonError('กรุณาระบุโค้ดคูปอง', 400);
  if (!['fixed', 'percentage'].includes(b.type ?? '')) return jsonError('ประเภทส่วนลดต้องเป็น fixed หรือ percentage', 400);
  if (typeof b.value !== 'number' || !Number.isFinite(b.value) || b.value <= 0) return jsonError('กรุณาระบุมูลค่าส่วนลดให้ถูกต้อง', 400);
  if (b.type === 'percentage' && b.value > 100) return jsonError('ส่วนลดเปอร์เซ็นต์ต้องไม่เกิน 100', 400);

  // โค้ดต้องไม่ซ้ำทั้งระบบ (มี UNIQUE constraint)
  const exists = await sbOne<{ id: string }>('promotions', { code: `eq.${code}`, select: 'id' });
  if (exists) return jsonError('มีโค้ดนี้ในระบบแล้ว กรุณาใช้โค้ดอื่น', 409);

  const expiresIso = b.expiresAt ? `${b.expiresAt}T23:59:59+07:00` : new Date(Date.now() + 90 * 86400_000).toISOString();

  // ตาราง promotions บังคับคอลัมน์ครบ — เติมทุกช่อง NOT NULL ให้ฐานข้อมูลจริง
  const [created] = await sbInsert<{ id: string; code: string }>('promotions', {
    code,
    name: b.name?.trim() || `คูปอง ${code}`,
    type: b.type,
    // fixed เก็บหน่วยสตางค์ (บาท × 100), percentage เก็บจำนวนเต็ม 1-100
    value: b.type === 'fixed' ? Math.round(b.value * 100) : Math.round(b.value),
    min_order_amount: Math.round((b.minOrderBaht ?? 0) * 100),
    ...(b.maxDiscountBaht ? { max_discount: Math.round(b.maxDiscountBaht * 100) } : {}),
    usage_limit: typeof b.usageLimit === 'number' && b.usageLimit > 0 ? Math.round(b.usageLimit) : 100,
    usage_count: 0,
    current_usage_count: 0,
    max_per_user: typeof b.maxPerUser === 'number' && b.maxPerUser > 0 ? Math.round(b.maxPerUser) : null,
    first_order_only: b.firstOrderOnly ?? false,
    is_stackable: false,
    channels: [],
    budget: 0,
    used_budget: 0,
    starts_at: new Date().toISOString(),
    expires_at: expiresIso,
    is_active: true,
    status: 'active',
    restaurant_id: owner.restaurantId,
    created_by_id: user.id,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
  return Response.json({ ok: true, promotion: created }, { status: 201 });
}
