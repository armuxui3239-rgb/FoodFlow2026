import { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import { sbOne, sbList, sbUpdate } from '@/lib/supabase';
import { normalizePhone, maskPhone } from '@/lib/auth-flow';
import { serializeSession, sessionCookieOptions, SESSION_COOKIE } from '@/lib/session';

interface DbUser {
  id: string;
  email: string;
  phone: string | null;
  full_name: string | null;
  is_active: boolean;
  failed_login_count: number;
  locked_until: string | null;
}

interface PinPrefs {
  pin_hash?: string;
  [key: string]: unknown;
}

const MAX_FAILED = 5;
const LOCK_MINUTES = 15;

export async function POST(req: NextRequest) {
  try {
    const { phone: rawPhone, pin, remember } = (await req.json()) as {
      phone?: string;
      pin?: string;
      remember?: boolean;
    };
    const phone = normalizePhone(rawPhone ?? '');
    if (!phone) {
      return Response.json({ error: 'เบอร์โทรไม่ถูกต้อง' }, { status: 400 });
    }
    if (!pin || !/^\d{6}$/.test(pin)) {
      return Response.json({ error: 'กรุณากรอก PIN 6 หลัก' }, { status: 400 });
    }

    const users = await sbList<DbUser>('users', {
      phone: `eq.${phone}`,
      role: 'eq.customer',
      is_active: 'eq.true',
      phone_verified_at: 'not.is.null',
      select: 'id,email,phone,full_name,is_active,failed_login_count,locked_until',
    });
    const user = users[0];
    if (!user) {
      return Response.json(
        { error: 'ไม่พบบัญชีนี้ในระบบ กรุณาสมัครสมาชิกก่อน' },
        { status: 401 },
      );
    }
    if (user.locked_until && new Date(user.locked_until).getTime() > Date.now()) {
      const mins = Math.ceil((new Date(user.locked_until).getTime() - Date.now()) / 60000);
      return Response.json(
        { error: `บัญชีถูกล็อกชั่วคราว ลองอีกครั้งใน ${mins} นาที` },
        { status: 423 },
      );
    }

    const profile = await sbOne<{ preferences: PinPrefs | null }>('customer_profiles', {
      user_id: `eq.${user.id}`,
      select: 'preferences',
    });
    const pin_hash = profile?.preferences?.pin_hash;
    if (!pin_hash) {
      return Response.json(
        { error: 'ยังไม่ได้ตั้ง PIN กรุณากด "ลืม PIN" เพื่อตั้งรหัสใหม่' },
        { status: 409 },
      );
    }

    if (!bcrypt.compareSync(pin, pin_hash)) {
      const count = (user.failed_login_count ?? 0) + 1;
      if (count >= MAX_FAILED) {
        await sbUpdate('users', { id: `eq.${user.id}` }, {
          failed_login_count: 0,
          locked_until: new Date(Date.now() + LOCK_MINUTES * 60000).toISOString(),
          updated_at: new Date().toISOString(),
        });
        return Response.json(
          { error: `PIN ผิด ${MAX_FAILED} ครั้ง บัญชีถูกล็อก ${LOCK_MINUTES} นาที` },
          { status: 423 },
        );
      }
      await sbUpdate('users', { id: `eq.${user.id}` }, {
        failed_login_count: count,
        updated_at: new Date().toISOString(),
      });
      return Response.json(
        { error: `PIN ไม่ถูกต้อง (พยายามได้อีก ${MAX_FAILED - count} ครั้ง)` },
        { status: 401 },
      );
    }

    await sbUpdate('users', { id: `eq.${user.id}` }, {
      failed_login_count: 0,
      locked_until: null,
      updated_at: new Date().toISOString(),
    });

    const session = {
      id: user.id,
      email: user.email,
      role: 'customer',
      fullName: user.full_name ?? '',
    };
    const opt = sessionCookieOptions();
    const maxAge = remember ? 60 * 60 * 24 * 30 : opt.maxAge;
    const res = Response.json({
      user: session,
      phoneMasked: maskPhone(phone),
    });
    res.headers.append(
      'Set-Cookie',
      `${SESSION_COOKIE}=${serializeSession(session)}; Path=${opt.path}; Max-Age=${maxAge}; HttpOnly; SameSite=Lax`,
    );
    return res;
  } catch (err) {
    console.error('login-pin error:', err);
    return Response.json({ error: 'เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่' }, { status: 500 });
  }
}
