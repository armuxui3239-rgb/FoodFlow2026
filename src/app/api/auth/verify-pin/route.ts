import { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import { sbOne, sbUpdate } from '@/lib/supabase';
import { currentUser, jsonError } from '@/lib/api-user';

interface PinPrefs {
  pin_hash?: string;
  [key: string]: unknown;
}

const MAX_FAILED = 5;
const LOCK_MINUTES = 15;

/** POST /api/auth/verify-pin — ยืนยัน PIN ของผู้ใช้ที่ล็อกอินอยู่ (ใช้ยืนยันก่อนเติมเงิน — v4 ข้อ 4.5)
 *  กติกาเดียวกับ login-pin: ผิด 5 ครั้ง -> ล็อกบัญชี 15 นาที (locked_until) */
export async function POST(req: NextRequest) {
  try {
    const session = await currentUser();
    if (!session) return jsonError('กรุณาเข้าสู่ระบบ', 401);
    if (session.role !== 'customer') return jsonError('เฉพาะบัญชีลูกค้าเท่านั้น', 403);

    const { pin } = (await req.json().catch(() => ({}))) as { pin?: string };
    if (!pin || !/^\d{6}$/.test(pin)) return jsonError('กรุณากรอก PIN 6 หลัก', 400);

    const user = await sbOne<{
      id: string;
      failed_login_count: number;
      locked_until: string | null;
    }>('users', {
      id: `eq.${session.id}`,
      select: 'id,failed_login_count,locked_until',
    });
    if (!user) return jsonError('ไม่พบบัญชีนี้ในระบบ', 404);

    if (user.locked_until && new Date(user.locked_until).getTime() > Date.now()) {
      const mins = Math.ceil((new Date(user.locked_until).getTime() - Date.now()) / 60000);
      return jsonError(`บัญชีถูกล็อกชั่วคราว ลองอีกครั้งใน ${mins} นาที`, 423);
    }

    const profile = await sbOne<{ preferences: PinPrefs | null }>('customer_profiles', {
      user_id: `eq.${user.id}`,
      select: 'preferences',
    });
    const pin_hash = profile?.preferences?.pin_hash;
    if (!pin_hash) return jsonError('ยังไม่ได้ตั้ง PIN', 409);

    if (!bcrypt.compareSync(pin, pin_hash)) {
      const count = (user.failed_login_count ?? 0) + 1;
      if (count >= MAX_FAILED) {
        await sbUpdate('users', { id: `eq.${user.id}` }, {
          failed_login_count: 0,
          locked_until: new Date(Date.now() + LOCK_MINUTES * 60000).toISOString(),
          updated_at: new Date().toISOString(),
        });
        return jsonError(`PIN ผิด ${MAX_FAILED} ครั้ง บัญชีถูกล็อก ${LOCK_MINUTES} นาที`, 423);
      }
      await sbUpdate('users', { id: `eq.${user.id}` }, {
        failed_login_count: count,
        updated_at: new Date().toISOString(),
      });
      return jsonError(`PIN ไม่ถูกต้อง (พยายามได้อีก ${MAX_FAILED - count} ครั้ง)`, 401);
    }

    await sbUpdate('users', { id: `eq.${user.id}` }, {
      failed_login_count: 0,
      locked_until: null,
      updated_at: new Date().toISOString(),
    });
    return Response.json({ ok: true });
  } catch (err) {
    console.error('verify-pin error:', err);
    return jsonError('ยืนยัน PIN ไม่สำเร็จ กรุณาลองใหม่', 500);
  }
}
