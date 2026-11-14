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

/** GET /api/admin/restaurants/[id] — รายละเอียดร้าน + เจ้าของ + 20 ออเดอร์ล่าสุด + รายได้รวม (delivered/completed) */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const admin = await requireRole('admin');
  if (!admin) return jsonError('เฉพาะผู้ดูแลระบบเท่านั้น', 403);
  const { id } = await ctx.params;

  const restaurant = await sbOne<{
    id: string;
    name: string;
    slug: string;
    description: string | null;
    logo_url: string | null;
    address_line: string;
    city: string;
    district: string | null;
    phone: string | null;
    cuisine_types: string[] | null;
    price_range: string;
    rating: number;
    total_reviews: number;
    is_open: boolean;
    is_active: boolean;
    approval_status: string;
    min_order_amount: number;
    prep_time_avg_minutes: number;
    created_at: string;
  }>('restaurants', {
    id: `eq.${id}`,
    select:
      'id,name,slug,description,logo_url,address_line,city,district,phone,cuisine_types,price_range,rating,total_reviews,is_open,is_active,approval_status,min_order_amount,prep_time_avg_minutes,created_at',
  });
  if (!restaurant) return jsonError('ไม่พบร้านนี้', 404);

  const [profiles, recentOrders, deliveredOrders] = await Promise.all([
    sbList<{ id: string; user_id: string; staff_role: string; is_active: boolean; joined_at: string }>('restaurant_profiles', {
      restaurant_id: `eq.${id}`,
      select: 'id,user_id,staff_role,is_active,joined_at',
      limit: '20',
    }),
    sbList<{ id: string; order_code: string; status: string; total: number; customer_id: string; created_at: string }>('orders', {
      restaurant_id: `eq.${id}`,
      select: 'id,order_code,status,total,customer_id,created_at',
      order: 'created_at.desc',
      limit: '20',
    }),
    sbList<{ total: number }>('orders', {
      restaurant_id: `eq.${id}`,
      status: 'in.(delivered,completed)',
      select: 'total',
      order: 'created_at.desc',
      limit: '1000',
    }),
  ]);

  const userIds = [
    ...new Set([...profiles.map((p) => p.user_id), ...recentOrders.map((o) => o.customer_id)]),
  ];
  const users = userIds.length
    ? await sbList<{ id: string; full_name: string; email: string; phone: string | null }>('users', {
        id: `in.(${userIds.join(',')})`,
        select: 'id,full_name,email,phone',
        limit: '100',
      })
    : [];

  return Response.json({
    restaurant,
    owners: profiles.map((p) => ({
      ...p,
      user: users.find((u) => u.id === p.user_id) ?? null,
    })),
    orders: recentOrders.map((o) => ({
      ...o,
      customerName: users.find((u) => u.id === o.customer_id)?.full_name ?? '-',
    })),
    // รายได้รวมจากออเดอร์ delivered/completed (นับได้สูงสุด 1,000 รายการล่าสุด)
    revenueSatang: deliveredOrders.reduce((s, o) => s + Number(o.total), 0),
    deliveredCount: deliveredOrders.length,
  });
}

/**
 * PATCH /api/admin/restaurants/[id] — อนุมัติ/ระงับ/เปิด-ปิดร้าน + บันทึก audit log
 * { approvalStatus?: 'approved'|'pending'|'rejected'|'suspended', isActive?, isOpen? }
 */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const admin = await requireRole('admin');
  if (!admin) return jsonError('เฉพาะผู้ดูแลระบบเท่านั้น', 403);
  const { id } = await ctx.params;
  const { approvalStatus, isActive, isOpen } = (await req.json().catch(() => ({}))) as {
    approvalStatus?: string;
    isActive?: boolean;
    isOpen?: boolean;
  };

  const patch: Record<string, unknown> = {};
  if (approvalStatus !== undefined) {
    if (!['approved', 'pending', 'rejected', 'suspended'].includes(approvalStatus)) {
      return jsonError('approvalStatus ไม่ถูกต้อง', 400);
    }
    patch.approval_status = approvalStatus;
  }
  if (typeof isActive === 'boolean') patch.is_active = isActive;
  if (typeof isOpen === 'boolean') patch.is_open = isOpen;
  if (Object.keys(patch).length === 0) return jsonError('ไม่มีข้อมูลที่จะแก้', 400);

  const before = await sbOne<{ approval_status: string; is_active: boolean; is_open: boolean }>('restaurants', {
    id: `eq.${id}`,
    select: 'approval_status,is_active,is_open',
  });
  if (!before) return jsonError('ไม่พบร้านนี้', 404);

  const [updated] = await sbUpdate<{ id: string }>('restaurants', { id: `eq.${id}` }, patch);
  if (!updated) return jsonError('ไม่พบร้านนี้', 404);

  await logAudit(admin.id, 'restaurant.update', 'restaurant', id, req, patch);
  return Response.json({ ok: true });
}
