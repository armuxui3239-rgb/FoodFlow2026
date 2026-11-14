import { NextRequest } from 'next/server';
import { requireRole } from '@/lib/portal';
import { sbList, sbOne, sbUpdate } from '@/lib/supabase';
import { jsonError } from '@/lib/api-user';

interface DriverOnboardingProfile {
  id: string;
  terms_accepted_at: string | null;
  terms_version: string | null;
  license_number: string | null;
  vehicle_plate: string | null;
  vehicle_type: string | null;
}

/** GET /api/driver/onboarding — สถานะขั้นตอนสมัครของไรเดอร์ (ข้อตกลง / ยานพาหนะ / KYC) */
export async function GET(_req: NextRequest) {
  const user = await requireRole('driver');
  if (!user) return jsonError('เฉพาะไรเดอร์เท่านั้น', 403);

  const profile = await sbOne<DriverOnboardingProfile>('driver_profiles', {
    user_id: `eq.${user.id}`,
    select: 'id,terms_accepted_at,terms_version,license_number,vehicle_plate,vehicle_type',
  });
  if (!profile) return jsonError('ยังไม่มีโปรไฟล์ไรเดอร์สำหรับบัญชีนี้', 404);

  const subs = await sbList<{ status: 'pending' | 'approved' | 'rejected' }>('driver_kyc_submissions', {
    driver_profile_id: `eq.${profile.id}`,
    select: 'status',
    order: 'created_at.desc.nullslast',
    limit: '1',
  });

  return Response.json({
    termsAcceptedAt: profile.terms_accepted_at,
    termsVersion: profile.terms_version,
    licenseNumber: profile.license_number,
    vehiclePlate: profile.vehicle_plate,
    vehicleType: profile.vehicle_type,
    kycStatus: subs[0]?.status ?? null,
  });
}

/** PATCH /api/driver/onboarding — บันทึกการยอมรับข้อตกลงไรเดอร์ { termsAccepted: true } */
export async function PATCH(req: NextRequest) {
  const user = await requireRole('driver');
  if (!user) return jsonError('เฉพาะไรเดอร์เท่านั้น', 403);

  const body = (await req.json().catch(() => ({}))) as { termsAccepted?: boolean };
  if (body.termsAccepted !== true) return jsonError('กรุณาติ๊กยอมรับข้อตกลงก่อนส่ง', 400);

  const now = new Date().toISOString();
  const [updated] = await sbUpdate<{
    id: string;
    terms_accepted_at: string;
    terms_version: string;
  }>('driver_profiles', { user_id: `eq.${user.id}` }, { terms_accepted_at: now, terms_version: 'v1' });
  if (!updated) return jsonError('ยังไม่มีโปรไฟล์ไรเดอร์สำหรับบัญชีนี้', 404);

  return Response.json({ ok: true, termsAcceptedAt: updated.terms_accepted_at, termsVersion: updated.terms_version });
}
