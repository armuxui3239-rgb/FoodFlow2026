import { NextRequest } from 'next/server';
import { requireRole } from '@/lib/portal';
import { sbOne, sbUpdate } from '@/lib/supabase';
import { jsonError } from '@/lib/api-user';

interface DriverProfile {
  id: string;
  user_id: string;
  vehicle_type: string;
  vehicle_plate: string | null;
  license_number: string | null;
  max_delivery_radius_km: number | null;
  is_online: boolean;
  rating: number | null;
  total_deliveries: number | null;
  total_earnings: number | null;
}

/** GET /api/driver/me — โปรไฟล์ไรเดอร์ + สถิติ */
export async function GET(_req: NextRequest) {
  const user = await requireRole('driver');
  if (!user) return jsonError('เฉพาะไรเดอร์เท่านั้น', 403);
  const profile = await sbOne<DriverProfile>('driver_profiles', {
    user_id: `eq.${user.id}`,
    select: 'id,user_id,vehicle_type,vehicle_plate,license_number,max_delivery_radius_km,is_online,rating,total_deliveries,total_earnings',
  });
  if (!profile) return jsonError('ยังไม่มีโปรไฟล์ไรเดอร์สำหรับบัญชีนี้', 404);
  return Response.json({ driver: profile, fullName: user.fullName });
}

/** PATCH /api/driver/me — เปิด/ปิดรับงาน { isOnline } และ/หรือแก้ข้อมูลยานพาหนะ { vehiclePlate, licenseNumber, maxRadiusKm } */
export async function PATCH(req: NextRequest) {
  const user = await requireRole('driver');
  if (!user) return jsonError('เฉพาะไรเดอร์เท่านั้น', 403);

  const body = (await req.json().catch(() => ({}))) as {
    isOnline?: boolean;
    vehicleType?: string;
    vehiclePlate?: string;
    licenseNumber?: string;
    maxRadiusKm?: number;
  };

  const patch: Record<string, unknown> = {};
  if (typeof body.isOnline === 'boolean') patch.is_online = body.isOnline;

  if (body.vehicleType !== undefined) {
    const vt = String(body.vehicleType).trim();
    if (!['motorbike', 'car', 'bicycle'].includes(vt)) return jsonError('ประเภทยานพาหนะไม่ถูกต้อง', 400);
    patch.vehicle_type = vt;
  }

  if (body.vehiclePlate !== undefined) {
    const plate = String(body.vehiclePlate).trim().toUpperCase();
    if (plate.length < 3 || plate.length > 30) return jsonError('ทะเบียนรถไม่ถูกต้อง (3–30 ตัวอักษร)', 400);
    patch.vehicle_plate = plate;
  }
  if (body.licenseNumber !== undefined) {
    const license = String(body.licenseNumber).trim();
    if (license.length > 30) return jsonError('เลขใบอนุญาตขับขี่ยาวเกินไป', 400);
    patch.license_number = license === '' ? null : license;
  }
  if (body.maxRadiusKm !== undefined) {
    const km = Number(body.maxRadiusKm);
    if (!Number.isInteger(km) || km < 1 || km > 30) return jsonError('รัศมีพื้นที่ให้บริการต้องเป็น 1–30 กม.', 400);
    patch.max_delivery_radius_km = km;
  }

  if (Object.keys(patch).length === 0) return jsonError('ไม่มีข้อมูลที่ต้องแก้ไข', 400);

  const [updated] = await sbUpdate<{
    id: string;
    is_online: boolean;
    vehicle_plate: string | null;
  }>('driver_profiles', { user_id: `eq.${user.id}` }, patch);
  if (!updated) return jsonError('ยังไม่มีโปรไฟล์ไรเดอร์สำหรับบัญชีนี้', 404);

  return Response.json({
    ok: true,
    isOnline: updated.is_online,
    vehiclePlate: updated.vehicle_plate,
  });
}
