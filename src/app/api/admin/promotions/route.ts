import { NextRequest } from 'next/server';
import { requireRole } from '@/lib/portal';
import { sbList, sbInsert, sbUpdate, sbOne } from '@/lib/supabase';
import { jsonError } from '@/lib/api-user';

/** GET /api/admin/promotions — คูปองทั้งหมด */
export async function GET(_req: NextRequest) {
  const user = await requireRole('admin');
  if (!user) return jsonError('เฉพาะผู้ดูแลระบบเท่านั้น', 403);
  const promos = await sbList<{
    id: string;
    code: string;
    name: string;
    type: string;
    value: number;
    min_order_amount: number;
    max_discount: number | null;
    usage_count: number;
    usage_limit: number | null;
    expires_at: string | null;
    is_active: boolean;
  }>('promotions', {
    select: 'id,code,name,type,value,min_order_amount,max_discount,usage_count,usage_limit,expires_at,is_active',
    order: 'code.asc',
    limit: '100',
  });
  return Response.json({ data: promos });
}

/**
 * POST /api/admin/promotions — สร้างคูปองใหม่
 * { code, name, type: 'percentage'|'fixed', value, minOrderBaht, maxDiscountBaht?, usageLimit?, expiresAt? }
 */
export async function POST(req: NextRequest) {
  const admin = await requireRole('admin');
  if (!admin) return jsonError('เฉพาะผู้ดูแลระบบเท่านั้น', 403);
  const b = (await req.json().catch(() => ({}))) as {
    code?: string;
    name?: string;
    type?: string;
    value?: number;
    minOrderBaht?: number;
    maxDiscountBaht?: number | null;
    usageLimit?: number | null;
    expiresAt?: string | null;
  };
  if (!b.code || !b.type || typeof b.value !== 'number' || b.value <= 0) {
    return jsonError('กรุณาระบุ code, type และ value ให้ถูกต้อง', 400);
  }
  if (!['percentage', 'fixed'].includes(b.type)) return jsonError('type ต้องเป็น percentage หรือ fixed', 400);
  if (b.type === 'percentage' && b.value > 100) return jsonError('ส่วนลดเปอร์เซ็นต์ต้องไม่เกิน 100', 400);

  const exists = await sbOne<{ id: string }>('promotions', { code: `eq.${b.code.toUpperCase()}`, select: 'id' });
  if (exists) return jsonError('มีโค้ดนี้ในระบบแล้ว', 409);

  // ตาราง promotions บังคับคอลัมน์ครบ — เติมค่าเริ่มต้นทุกช่องที่จำเป็น
  // value: fixed เก็บหน่วยสตางค์ (บาท × 100), percentage เก็บจำนวนเต็ม 1-100
  const [created] = await sbInsert<{ id: string; code: string }>('promotions', {
    code: b.code.toUpperCase(),
    name: b.name?.trim() || `โปรโมชั่น ${b.code.toUpperCase()}`,
    type: b.type,
    value: b.type === 'fixed' ? Math.round(b.value * 100) : Math.round(b.value),
    min_order_amount: Math.round((b.minOrderBaht ?? 0) * 100),
    ...(b.maxDiscountBaht ? { max_discount: Math.round(b.maxDiscountBaht * 100) } : {}),
    usage_limit: b.usageLimit ?? 500,
    usage_count: 0,
    current_usage_count: 0,
    first_order_only: false,
    is_stackable: false,
    channels: [],
    budget: 0,
    used_budget: 0,
    starts_at: new Date().toISOString(),
    expires_at: b.expiresAt ?? new Date(Date.now() + 90 * 86400_000).toISOString(),
    is_active: true,
    status: 'active',
    created_by_id: admin.id,
  });
  return Response.json({ ok: true, promotion: created }, { status: 201 });
}

/** PATCH /api/admin/promotions — เปิด/ปิดคูปอง { id, isActive } */
export async function PATCH(req: NextRequest) {
  const admin = await requireRole('admin');
  if (!admin) return jsonError('เฉพาะผู้ดูแลระบบเท่านั้น', 403);
  const { id, isActive } = (await req.json().catch(() => ({}))) as { id?: string; isActive?: boolean };
  if (!id || typeof isActive !== 'boolean') return jsonError('กรุณาระบุ id และ isActive', 400);
  const [updated] = await sbUpdate<{ id: string; is_active: boolean }>('promotions', { id: `eq.${id}` }, { is_active: isActive });
  if (!updated) return jsonError('ไม่พบคูปองนี้', 404);
  return Response.json({ ok: true, isActive: updated.is_active });
}
