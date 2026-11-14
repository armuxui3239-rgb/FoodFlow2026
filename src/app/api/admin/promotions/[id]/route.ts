import { NextRequest } from 'next/server';
import { requireRole } from '@/lib/portal';
import { sbList, sbOne, sbUpdate, sbDelete, sbHeaders } from '@/lib/supabase';
import { jsonError } from '@/lib/api-user';

/** บันทึก admin_audit_logs (id BIGSERIAL — ใช้ fetch ตรงเพื่อไม่ให้ sbInsert เติม uuid) */
async function logAudit(
  adminId: string,
  action: string,
  targetType: string,
  targetId: string | null,
  req: NextRequest,
  newValue?: unknown,
): Promise<void> {
  const row: Record<string, unknown> = {
    admin_id: adminId,
    action,
    target_type: targetType,
    ...(targetId ? { target_id: targetId } : {}),
    ...(newValue !== undefined ? { new_value: newValue as never } : {}),
    ip_address: (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || '0.0.0.0',
    severity: 'info',
    created_at: new Date().toISOString(),
  };
  try {
    await fetch(`${process.env.SUPABASE_URL}/rest/v1/admin_audit_logs`, {
      method: 'POST',
      headers: { ...sbHeaders(), Prefer: 'return=minimal' },
      body: JSON.stringify([row]),
    });
  } catch {
    // บันทึกตรวจสอบล้มเหลวต้องไม่ทำให้การทำงานหลักล้ม
  }
}

interface PromoRow {
  id: string;
  code: string;
  name: string;
  description: string | null;
  type: string;
  value: number;
  min_order_amount: number;
  max_discount: number | null;
  usage_count: number;
  usage_limit: number | null;
  max_per_user: number | null;
  first_order_only: boolean;
  is_stackable: boolean;
  starts_at: string;
  expires_at: string | null;
  is_active: boolean;
  status: string;
}

/** GET /api/admin/promotions/[id] — รายละเอียดคูปอง + สถิติการใช้ + 20 รายการล่าสุด (ต่อผู้ใช้) */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const admin = await requireRole('admin');
  if (!admin) return jsonError('เฉพาะผู้ดูแลระบบเท่านั้น', 403);
  const { id } = await ctx.params;

  const promo = await sbOne<PromoRow>('promotions', {
    id: `eq.${id}`,
    select:
      'id,code,name,description,type,value,min_order_amount,max_discount,usage_count,usage_limit,max_per_user,first_order_only,is_stackable,starts_at,expires_at,is_active,status',
  });
  if (!promo) return jsonError('ไม่พบคูปองนี้', 404);

  const usages = await sbList<{
    id: string;
    user_id: string;
    order_id: string;
    discount_amount: number;
    used_at: string;
  }>('promotion_usages', {
    promotion_id: `eq.${id}`,
    select: 'id,user_id,order_id,discount_amount,used_at',
    order: 'used_at.desc',
    limit: '20',
  });

  const userIds = [...new Set(usages.map((u) => u.user_id))];
  const users = userIds.length
    ? await sbList<{ id: string; full_name: string; email: string }>('users', {
        id: `in.(${userIds.join(',')})`,
        select: 'id,full_name,email',
        limit: '100',
      })
    : [];

  // สถิติรวม (นับได้สูงสุด 1,000 รายการล่าสุด)
  const allUsages = await sbList<{ user_id: string; discount_amount: number; used_at: string }>('promotion_usages', {
    promotion_id: `eq.${id}`,
    select: 'user_id,discount_amount,used_at',
    order: 'used_at.desc',
    limit: '1000',
  });

  return Response.json({
    promotion: promo,
    usages: usages.map((u) => ({
      ...u,
      userName: users.find((x) => x.id === u.user_id)?.full_name ?? '-',
      userEmail: users.find((x) => x.id === u.user_id)?.email ?? '-',
    })),
    stats: {
      totalUsed: promo.usage_count,
      recentUsedCapped: allUsages.length,
      totalDiscountSatang: allUsages.reduce((s, u) => s + Number(u.discount_amount), 0),
      distinctUsers: new Set(allUsages.map((u) => u.user_id)).size,
    },
  });
}

/**
 * PATCH /api/admin/promotions/[id] — แก้ไขคูปอง
 * { code?, name?, description?, type?, value?, minOrderBaht?, maxDiscountBaht?, usageLimit?, expiresAt?, isActive? }
 */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const admin = await requireRole('admin');
  if (!admin) return jsonError('เฉพาะผู้ดูแลระบบเท่านั้น', 403);
  const { id } = await ctx.params;
  const b = (await req.json().catch(() => ({}))) as {
    code?: string;
    name?: string;
    description?: string | null;
    type?: string;
    value?: number;
    minOrderBaht?: number;
    maxDiscountBaht?: number | null;
    usageLimit?: number | null;
    expiresAt?: string | null;
    isActive?: boolean;
  };

  const existing = await sbOne<{ id: string }>('promotions', { id: `eq.${id}`, select: 'id' });
  if (!existing) return jsonError('ไม่พบคูปองนี้', 404);

  const patch: Record<string, unknown> = {};
  if (b.code !== undefined) {
    const code = b.code.trim().toUpperCase();
    if (!code) return jsonError('โค้ดห้ามว่าง', 400);
    const dup = await sbOne<{ id: string }>('promotions', { code: `eq.${code}`, select: 'id' });
    if (dup && dup.id !== id) return jsonError('มีโค้ดนี้ในระบบแล้ว', 409);
    patch.code = code;
  }
  if (b.name !== undefined) {
    if (!b.name.trim()) return jsonError('ชื่อโปรโมชั่นห้ามว่าง', 400);
    patch.name = b.name.trim();
  }
  if (b.description !== undefined) patch.description = b.description;
  if (b.type !== undefined) {
    if (!['percentage', 'fixed'].includes(b.type)) return jsonError('type ต้องเป็น percentage หรือ fixed', 400);
    patch.type = b.type;
  }
  if (b.value !== undefined) {
    if (typeof b.value !== 'number' || b.value <= 0) return jsonError('value ต้องเป็นจำนวนบวก', 400);
    if ((patch.type ?? '') === 'percentage' && b.value > 100) return jsonError('ส่วนลดเปอร์เซ็นต์ต้องไม่เกิน 100', 400);
    patch.value = b.value;
  }
  if (b.minOrderBaht !== undefined) patch.min_order_amount = Math.round(b.minOrderBaht * 100);
  if (b.maxDiscountBaht !== undefined) {
    patch.max_discount = b.maxDiscountBaht ? Math.round(b.maxDiscountBaht * 100) : null;
  }
  if (b.usageLimit !== undefined) patch.usage_limit = b.usageLimit ?? 500;
  if (b.expiresAt !== undefined) patch.expires_at = b.expiresAt;
  if (b.isActive !== undefined) {
    patch.is_active = b.isActive;
    patch.status = b.isActive ? 'active' : 'inactive';
  }
  if (Object.keys(patch).length === 0) return jsonError('ไม่มีข้อมูลที่จะแก้', 400);

  const [updated] = await sbUpdate<{ id: string; code: string; is_active: boolean }>('promotions', { id: `eq.${id}` }, patch);
  if (!updated) return jsonError('ไม่พบคูปองนี้', 404);

  await logAudit(admin.id, 'promotion.update', 'promotion', id, req, patch);
  return Response.json({ ok: true, promotion: updated });
}

/** DELETE /api/admin/promotions/[id] — ลบคูปองถาวร */
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const admin = await requireRole('admin');
  if (!admin) return jsonError('เฉพาะผู้ดูแลระบบเท่านั้น', 403);
  const { id } = await ctx.params;

  const promo = await sbOne<{ id: string; code: string }>('promotions', { id: `eq.${id}`, select: 'id,code' });
  if (!promo) return jsonError('ไม่พบคูปองนี้', 404);

  await sbDelete('promotions', { id: `eq.${id}` });
  await logAudit(admin.id, 'promotion.delete', 'promotion', id, req, { code: promo.code });
  return Response.json({ ok: true });
}
