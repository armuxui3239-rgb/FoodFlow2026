import { cookies } from 'next/headers';
import { sbOne } from '@/lib/supabase';
import { PENDING_COOKIE, parsePending } from '@/lib/auth-flow';

/** GET /api/auth/reset-pin/status — ลูกค้าตรวจสถานะคำขอรีเซ็ต PIN (ใช้ pending cookie ที่ยืนยัน OTP แล้ว) */
export async function GET() {
  const cookieStore = await cookies();
  const flow = parsePending(cookieStore.get(PENDING_COOKIE)?.value);
  if (!flow || flow.purpose !== 'reset_pin') {
    return Response.json(
      { error: 'หมดเวลายืนยันตัวตน กรุณายืนยัน OTP ใหม่' },
      { status: 401 },
    );
  }

  const req = await sbOne<{ status: string }>('password_reset_tokens', {
    user_id: `eq.${flow.userId}`,
    expires_at: `gte.${new Date().toISOString()}`,
    order: 'created_at.desc',
    limit: '1',
    select: 'status',
  });

  return Response.json({ data: { status: req?.status ?? 'none' } });
}
