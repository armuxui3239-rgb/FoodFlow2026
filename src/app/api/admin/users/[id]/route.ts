import { NextRequest } from 'next/server';
import { requireRole } from '@/lib/portal';
import { sbList, sbOne, sbUpdate, sbHeaders } from '@/lib/supabase';
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

/** GET /api/admin/users/[id] — โปรไฟล์ผู้ใช้ + นับออเดอร์/รีวิว + 10 ออเดอร์ล่าสุด */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const admin = await requireRole('admin');
  if (!admin) return jsonError('เฉพาะผู้ดูแลระบบเท่านั้น', 403);
  const { id } = await ctx.params;

  const user = await sbOne<{
    id: string;
    email: string;
    phone: string | null;
    full_name: string;
    role: string;
    avatar_url: string | null;
    is_active: boolean;
    failed_login_count: number;
    locked_until: string | null;
    preferred_locale: string;
    created_at: string;
  }>('users', {
    id: `eq.${id}`,
    select:
      'id,email,phone,full_name,role,avatar_url,is_active,failed_login_count,locked_until,preferred_locale,created_at',
  });
  if (!user) return jsonError('ไม่พบผู้ใช้นี้', 404);

  const [orderIds, reviewIds, lastOrders] = await Promise.all([
    sbList<{ id: string }>('orders', { customer_id: `eq.${id}`, select: 'id', order: 'created_at.desc', limit: '1000' }),
    sbList<{ id: string }>('reviews', { customer_id: `eq.${id}`, select: 'id', order: 'created_at.desc', limit: '1000' }),
    sbList<{ id: string; order_code: string; status: string; total: number; restaurant_id: string; created_at: string }>('orders', {
      customer_id: `eq.${id}`,
      select: 'id,order_code,status,total,restaurant_id,created_at',
      order: 'created_at.desc',
      limit: '10',
    }),
  ]);

  const rstIds = [...new Set(lastOrders.map((o) => o.restaurant_id))];
  const restaurants = rstIds.length
    ? await sbList<{ id: string; name: string }>('restaurants', {
        id: `in.(${rstIds.join(',')})`,
        select: 'id,name',
        limit: '50',
      })
    : [];

  return Response.json({
    user,
    counts: {
      orders: orderIds.length,
      reviews: reviewIds.length,
    },
    lastOrders: lastOrders.map((o) => ({
      ...o,
      restaurantName: restaurants.find((r) => r.id === o.restaurant_id)?.name ?? '-',
    })),
  });
}

/** PATCH /api/admin/users/[id] — ระงับ/เปิดบัญชี { isActive } (ห้ามระงับตัวเอง) */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const admin = await requireRole('admin');
  if (!admin) return jsonError('เฉพาะผู้ดูแลระบบเท่านั้น', 403);
  const { id } = await ctx.params;
  const { isActive } = (await req.json().catch(() => ({}))) as { isActive?: boolean };
  if (typeof isActive !== 'boolean') return jsonError('กรุณาระบุ isActive', 400);
  // ห้ามระงับบัญชีของตัวเอง (กติกาเดียวกับ PATCH /api/admin/users)
  if (id === admin.id && !isActive) return jsonError('ห้ามระงับบัญชีของตัวเอง', 400);

  const before = await sbOne<{ id: string; is_active: boolean }>('users', { id: `eq.${id}`, select: 'id,is_active' });
  if (!before) return jsonError('ไม่พบผู้ใช้นี้', 404);

  const [updated] = await sbUpdate<{ id: string; is_active: boolean }>('users', { id: `eq.${id}` }, { is_active: isActive });
  if (!updated) return jsonError('ไม่พบผู้ใช้นี้', 404);

  await logAudit(admin.id, isActive ? 'user.activate' : 'user.suspend', 'user', id, req, { is_active: isActive });
  return Response.json({ ok: true, isActive: updated.is_active });
}
