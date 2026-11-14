import { NextRequest } from 'next/server';
import { requireRole } from '@/lib/portal';
import { sbUpdate } from '@/lib/supabase';
import { jsonError } from '@/lib/api-user';

/**
 * PATCH /api/driver/location — ไรเดอร์ส่งพิกัดปัจจุบัน { lat, lng }
 * เขียนลง driver_profiles.current_lat/current_lng เพื่อให้ลูกค้าติดตามไรเดอร์สด
 */
export async function PATCH(req: NextRequest) {
  const user = await requireRole('driver');
  if (!user) return jsonError('เฉพาะไรเดอร์เท่านั้น', 403);

  const body = (await req.json().catch(() => ({}))) as { lat?: unknown; lng?: unknown };

  // ต้องเป็นตัวเลขทั้งคู่ (ปฏิเสธ string/NaN)
  if (typeof body.lat !== 'number' || typeof body.lng !== 'number') {
    return jsonError('พิกัดต้องเป็นตัวเลข (lat, lng)', 400);
  }
  const { lat, lng } = body;
  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    return jsonError('พิกัดไม่ถูกต้อง', 400);
  }
  if (lat < -90 || lat > 90) {
    return jsonError('lat ต้องอยู่ในช่วง -90 ถึง 90', 400);
  }
  if (lng < -180 || lng > 180) {
    return jsonError('lng ต้องอยู่ในช่วง -180 ถึง 180', 400);
  }

  const [updated] = await sbUpdate<{ id: string }>(
    'driver_profiles',
    { user_id: `eq.${user.id}` },
    { current_lat: lat, current_lng: lng },
  );
  if (!updated) return jsonError('ยังไม่มีโปรไฟล์ไรเดอร์สำหรับบัญชีนี้', 404);

  return Response.json({ ok: true });
}
