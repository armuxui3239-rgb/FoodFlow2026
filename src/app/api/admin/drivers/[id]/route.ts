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

/** GET /api/admin/drivers/[id] — โปรไฟล์ไรเดอร์ (id = driver_profiles.id) + ผู้ใช้ + KYC ล่าสุด + งานส่งสำเร็จล่าสุด */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const admin = await requireRole('admin');
  if (!admin) return jsonError('เฉพาะผู้ดูแลระบบเท่านั้น', 403);
  const { id } = await ctx.params;

  const profile = await sbOne<{
    id: string;
    user_id: string;
    license_number: string | null;
    vehicle_type: string;
    vehicle_plate: string | null;
    is_online: boolean;
    is_verified: boolean;
    rating: number;
    total_deliveries: number;
    total_earnings: number;
    max_delivery_radius_km: number;
    terms_accepted_at: string | null;
  }>('driver_profiles', {
    id: `eq.${id}`,
    select:
      'id,user_id,license_number,vehicle_type,vehicle_plate,is_online,is_verified,rating,total_deliveries,total_earnings,max_delivery_radius_km,terms_accepted_at',
  });
  if (!profile) return jsonError('ไม่พบโปรไฟล์ไรเดอร์นี้', 404);

  const [users, kycList, trips] = await Promise.all([
    sbList<{ id: string; full_name: string; email: string; phone: string | null; is_active: boolean; created_at: string }>('users', {
      id: `eq.${profile.user_id}`,
      select: 'id,full_name,email,phone,is_active,created_at',
      limit: '1',
    }),
    sbList<{
      id: string;
      status: string;
      document_urls: unknown;
      rejection_reason: string | null;
      reviewed_by_id: string | null;
      reviewed_at: string | null;
      created_at: string;
    }>('driver_kyc_submissions', {
      driver_profile_id: `eq.${id}`,
      select: 'id,status,document_urls,rejection_reason,reviewed_by_id,reviewed_at,created_at',
      order: 'created_at.desc',
      limit: '5',
    }),
    sbList<{ id: string; order_code: string; status: string; total: number; restaurant_id: string; created_at: string }>('orders', {
      driver_id: `eq.${profile.user_id}`,
      status: 'in.(delivered,completed)',
      select: 'id,order_code,status,total,restaurant_id,created_at',
      order: 'created_at.desc',
      limit: '20',
    }),
  ]);

  const rstIds = [...new Set(trips.map((t) => t.restaurant_id))];
  const restaurants = rstIds.length
    ? await sbList<{ id: string; name: string }>('restaurants', {
        id: `in.(${rstIds.join(',')})`,
        select: 'id,name',
        limit: '50',
      })
    : [];

  return Response.json({
    profile,
    user: users[0] ?? null,
    kycSubmissions: kycList,
    trips: trips.map((t) => ({
      ...t,
      restaurantName: restaurants.find((r) => r.id === t.restaurant_id)?.name ?? '-',
    })),
  });
}

/**
 * PATCH /api/admin/drivers/[id] — ตรวจ KYC { kycSubmissionId, status: 'approved'|'rejected', rejectionReason? }
 * อนุมัติ → driver_profiles.is_verified = true; ปฏิเสธต้องระบุเหตุผล
 */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const admin = await requireRole('admin');
  if (!admin) return jsonError('เฉพาะผู้ดูแลระบบเท่านั้น', 403);
  const { id } = await ctx.params;
  const { kycSubmissionId, status, rejectionReason } = (await req.json().catch(() => ({}))) as {
    kycSubmissionId?: string;
    status?: string;
    rejectionReason?: string;
  };
  if (!kycSubmissionId || !status) return jsonError('กรุณาระบุ kycSubmissionId และ status', 400);
  if (!['approved', 'rejected'].includes(status)) return jsonError('status ต้องเป็น approved หรือ rejected', 400);
  if (status === 'rejected' && !rejectionReason?.trim()) return jsonError('กรุณาระบุเหตุผลการปฏิเสธ', 400);

  const submission = await sbOne<{ id: string; driver_profile_id: string; status: string }>('driver_kyc_submissions', {
    id: `eq.${kycSubmissionId}`,
    driver_profile_id: `eq.${id}`,
    select: 'id,driver_profile_id,status',
  });
  if (!submission) return jsonError('ไม่พบใบยื่น KYC นี้ (หรือไม่ได้เป็นของไรเดอร์คนนี้)', 404);
  if (submission.status !== 'pending') return jsonError('ใบยื่นนี้ถูกตรวจแล้ว', 409);

  const [updatedKyc] = await sbUpdate<{ id: string; status: string }>(
    'driver_kyc_submissions',
    { id: `eq.${kycSubmissionId}` },
    {
      status,
      reviewed_by_id: admin.id,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...(status === 'rejected' ? { rejection_reason: rejectionReason!.trim() } : { rejection_reason: null }),
    },
  );
  if (!updatedKyc) return jsonError('ไม่พบใบยื่น KYC นี้', 404);

  if (status === 'approved') {
    await sbUpdate('driver_profiles', { id: `eq.${id}` }, { is_verified: true });
  }

  await logAudit(admin.id, `driver.kyc_${status}`, 'driver_profile', id, req, {
    kycSubmissionId,
    status,
    ...(status === 'rejected' ? { rejectionReason: rejectionReason!.trim() } : {}),
  });

  return Response.json({ ok: true, kyc: updatedKyc });
}
