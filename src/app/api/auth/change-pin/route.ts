import { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import { sbOne, sbUpdate } from '@/lib/supabase';
import { currentUser, jsonError } from '@/lib/api-user';
import { isWeakPin } from '@/lib/auth-flow';

interface PinPrefs {
  pin_hash?: string;
  pin_set_at?: string;
  birth_date?: string;
  [key: string]: unknown;
}

const MAX_FAILED = 5;
const LOCK_MINUTES = 15;

/** POST /api/auth/change-pin — เปลี่ยน PIN: ต้องยืนยัน PIN เดิมก่อน (v4 ข้อ 4.5 / หน้าจอ 81)
 *  กติกาเดียวกับระบบล็อกอิน: ยืนยันเดิมผิด 5 ครั้ง -> ล็อกบัญชี */
export async function POST(req: NextRequest) {
  try {
    const session = await currentUser();
    if (!session) return jsonError('กรุณาเข้าสู่ระบบ', 401);
    if (session.role !== 'customer') return jsonError('เฉพาะบัญชีลูกค้าเท่านั้น', 403);

    const { oldPin, newPin } = (await req.json().catch(() => ({}))) as {
      oldPin?: string;
      newPin?: string;
    };
    if (!oldPin || !/^\d{6}$/.test(oldPin)) return jsonError('กรุณากรอก PIN เดิม 6 หลัก', 400);
    if (!newPin || !/^\d{6}$/.test(newPin)) return jsonError('กรุณากรอก PIN ใหม่ 6 หลัก', 400);

    const user = await sbOne<{
      id: string;
      password_hash: string | null;
      failed_login_count: number;
      locked_until: string | null;
    }>('users', {
      id: `eq.${session.id}`,
      select: 'id,password_hash,failed_login_count,locked_until',
    });
    if (!user) return jsonError('ไม่พบบัญชีนี้ในระบบ', 404);

    if (user.locked_until && new Date(user.locked_until).getTime() > Date.now()) {
      const mins = Math.ceil((new Date(user.locked_until).getTime() - Date.now()) / 60000);
      return jsonError(`บัญชีถูกล็อกชั่วคราว ลองอีกครั้งใน ${mins} นาที`, 423);
    }

    const profile = await sbOne<{ preferences: PinPrefs | null }>(
      'customer_profiles',
      { user_id: `eq.${user.id}`, select: 'preferences' },
    );
    const oldHash =
      profile?.preferences?.pin_set_at && user.password_hash
        ? user.password_hash
        : (profile?.preferences?.pin_hash ?? null);
    if (!oldHash) return jsonError('ยังไม่ได้ตั้ง PIN กรุณาใช้ "ลืม PIN" แทน', 409);

    if (!bcrypt.compareSync(oldPin, oldHash)) {
      const count = (user.failed_login_count ?? 0) + 1;
      if (count >= MAX_FAILED) {
        const recentLock = user.locked_until && Date.now() - new Date(user.locked_until).getTime() < 60 * 60 * 1000;
        const lockMinutes = recentLock ? LOCK_MINUTES * 2 : LOCK_MINUTES;
        await sbUpdate('users', { id: `eq.${user.id}` }, {
          failed_login_count: 0,
          locked_until: new Date(Date.now() + lockMinutes * 60000).toISOString(),
          updated_at: new Date().toISOString(),
        });
        return jsonError(`PIN เดิมผิด ${MAX_FAILED} ครั้ง บัญชีถูกล็อก ${lockMinutes} นาที`, 423);
      }
      await sbUpdate('users', { id: `eq.${user.id}` }, {
        failed_login_count: count,
        updated_at: new Date().toISOString(),
      });
      return jsonError(`PIN เดิมไม่ถูกต้อง (พยายามได้อีก ${MAX_FAILED - count} ครั้ง)`, 401);
    }

    if (newPin === oldPin) return jsonError('PIN ใหม่ต้องไม่ซ้ำกับ PIN เดิม', 400);
    const weak = isWeakPin(newPin, profile?.preferences?.birth_date ?? null);
    if (weak) return jsonError(weak, 400);

    const now = new Date().toISOString();
    const newHash = bcrypt.hashSync(newPin, 12);
    await sbUpdate('users', { id: `eq.${user.id}` }, {
      password_hash: newHash,
      failed_login_count: 0,
      locked_until: null,
      updated_at: now,
    });
    if (profile) {
      const prefs: PinPrefs = {
        ...(profile.preferences ?? {}),
        pin_hash: newHash,
        pin_set_at: now,
      };
      await sbUpdate('customer_profiles', { user_id: `eq.${user.id}` }, { preferences: prefs });
    }

    return Response.json({ ok: true });
  } catch (err) {
    console.error('change-pin error:', err);
    return jsonError('เปลี่ยน PIN ไม่สำเร็จ กรุณาลองใหม่', 500);
  }
}
