import { NextRequest } from 'next/server';
import { requireRole } from '@/lib/portal';
import { sbInsert, sbList, sbOne, sbUpdate } from '@/lib/supabase';
import { jsonError } from '@/lib/api-user';

export interface KycSubmission {
  id: string;
  driver_profile_id: string;
  status: 'pending' | 'approved' | 'rejected';
  document_urls: { type: string; label: string; url: string }[];
  rejection_reason: string | null;
  created_at: string;
  reviewed_at: string | null;
}

export interface DriverProfileFull {
  id: string;
  license_number: string | null;
  vehicle_plate: string | null;
  max_delivery_radius_km: number | null;
  terms_accepted_at: string | null;
}

/** GET /api/driver/kyc — สถานะยืนยันตัวตนล่าสุด + ข้อมูลยานพาหนะของฉัน */
export async function GET(_req: NextRequest) {
  const user = await requireRole('driver');
  if (!user) return jsonError('เฉพาะไรเดอร์เท่านั้น', 403);

  const profile = await sbOne<DriverProfileFull>('driver_profiles', {
    user_id: `eq.${user.id}`,
    select: 'id,license_number,vehicle_plate,max_delivery_radius_km,terms_accepted_at',
  });
  if (!profile) return jsonError('ยังไม่มีโปรไฟล์ไรเดอร์สำหรับบัญชีนี้', 404);

  const subs = await sbList<KycSubmission>('driver_kyc_submissions', {
    driver_profile_id: `eq.${profile.id}`,
    select: 'id,status,document_urls,rejection_reason,created_at,reviewed_at',
    order: 'created_at.desc.nullslast',
    limit: '1',
  });

  return Response.json({
    profile: {
      licenseNumber: profile.license_number ?? '',
      vehiclePlate: profile.vehicle_plate ?? '',
      maxRadiusKm: profile.max_delivery_radius_km ?? null,
      termsAccepted: Boolean(profile.terms_accepted_at),
    },
    latest: subs[0] ?? null,
  });
}

/** POST /api/driver/kyc — ส่งคำขอยืนยันตัวตน { licenseNumber, vehiclePlate, termsAccepted, documents } */
export async function POST(req: NextRequest) {
  const user = await requireRole('driver');
  if (!user) return jsonError('เฉพาะไรเดอร์เท่านั้น', 403);

  const { licenseNumber, vehiclePlate, termsAccepted, documents } = (await req.json().catch(() => ({}))) as {
    licenseNumber?: string;
    vehiclePlate?: string;
    termsAccepted?: boolean;
    documents?: { type: string; label: string; url: string }[];
  };

  const license = (licenseNumber ?? '').trim();
  const plate = (vehiclePlate ?? '').trim().toUpperCase();
  if (license.length < 4) return jsonError('กรุณาระบุเลขใบอนุญาตขับขี่ให้ครบถ้วน', 400);
  if (plate.length < 3) return jsonError('กรุณาระบุทะเบียนรถให้ถูกต้อง', 400);
  if (termsAccepted !== true) return jsonError('ต้องยอมรับข้อกำหนดและเงื่อนไขไรเดอร์ก่อนส่งคำขอ', 400);

  const docs = Array.isArray(documents)
    ? documents
        .filter((d) => (d?.url ?? '').trim() !== '')
        .slice(0, 5)
        .map((d) => ({ type: (d.type ?? 'other').slice(0, 50), label: (d.label ?? '').slice(0, 100), url: (d.url ?? '').trim() }))
    : [];

  const profile = await sbOne<{ id: string }>('driver_profiles', { user_id: `eq.${user.id}`, select: 'id' });
  if (!profile) return jsonError('ยังไม่มีโปรไฟล์ไรเดอร์สำหรับบัญชีนี้', 404);

  // มีคำขอที่ยังรอตรวจอยู่ → ไม่ให้ส่งซ้ำ
  const waiting = await sbList<{ id: string }>('driver_kyc_submissions', {
    driver_profile_id: `eq.${profile.id}`,
    status: 'eq.pending',
    select: 'id',
    limit: '1',
  });
  if (waiting.length > 0) return jsonError('คุณมีคำขอที่กำลังรอตรวจสอบอยู่แล้ว', 409);

  const now = new Date().toISOString();
  const [sub] = await sbInsert<KycSubmission>('driver_kyc_submissions', {
    driver_profile_id: profile.id,
    status: 'pending',
    document_urls: docs,
    created_at: now,
    updated_at: now,
  });

  // อัปเดตข้อมูลยานพาหนะ + บันทึกการยอมรับเงื่อนไขพร้อมกับคำขอ
  await sbUpdate(
    'driver_profiles',
    { id: `eq.${profile.id}` },
    {
      license_number: license,
      vehicle_plate: plate,
      terms_accepted_at: now,
      terms_version: 'v1',
    },
  );

  return Response.json({ data: sub }, { status: 201 });
}
