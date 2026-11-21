import { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { cookies } from 'next/headers';
import { sbOne, sbUpdate, sbInsert } from '@/lib/supabase';
import { PENDING_COOKIE, parsePending, isWeakPin } from '@/lib/auth-flow';
import { serializeSession, sessionCookieValue, clearNamedCookieValue } from '@/lib/session';

interface PinPrefs {
  pin_hash?: string;
  pin_set_at?: string;
  birth_date?: string;
  biometric_enabled?: boolean;
  [key: string]: unknown;
}

interface CustomerProfile {
  id: string;
  user_id: string;
  preferences: PinPrefs | null;
}

const MAX_PIN_AGE_DAYS = 180; // บังคับเปลี่ยน PIN ทุก 180 วัน (เก็บวันที่ตั้ง)

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const flow = parsePending(cookieStore.get(PENDING_COOKIE)?.value);
    if (!flow) {
      return Response.json({ error: 'หมดเวลาดำเนินการ กรุณาเริ่มใหม่' }, { status: 401 });
    }
    const { pin } = (await req.json()) as { pin?: string };
    if (!pin || !/^\d{6}$/.test(pin)) {
      return Response.json({ error: 'PIN ต้องเป็นตัวเลข 6 หลัก' }, { status: 400 });
    }

    const profile = await sbOne<CustomerProfile>('customer_profiles', {
      user_id: `eq.${flow.userId}`,
      select: 'id,user_id,preferences',
    });

    // ปฏิเสธ PIN ที่เดาง่าย: เลขซ้ำ / เรียงต่อเนื่อง / วันเกิดของผู้ใช้ (เก็บใน preferences.birth_date) — v4 ข้อ 4.5
    const weak = isWeakPin(pin, profile?.preferences?.birth_date ?? null);
    if (weak) {
      return Response.json({ error: weak }, { status: 400 });
    }

    // ตรวจสิทธิ์คำขอลืม PIN ก่อนเขียนข้อมูลลงฐานข้อมูลเสมอ
    let approvedTokenId: string | null = null;
    if (flow.purpose !== 'register') {
      const approved = await sbOne<{ id: string }>('password_reset_tokens', {
        user_id: `eq.${flow.userId}`,
        status: 'eq.approved',
        used_at: 'is.null',
        expires_at: `gte.${new Date().toISOString()}`,
        select: 'id',
      });
      if (!approved) {
        return Response.json(
          { error: 'คำขอรีเซ็ต PIN ยังไม่ได้รับอนุมัติจากผู้ดูแลระบบ' },
          { status: 403 },
        );
      }
      approvedTokenId = approved.id;
    }

    const dbUser = await sbOne<{ id: string; session_version: number }>('users', {
      id: `eq.${flow.userId}`,
      select: 'id,session_version',
    });
    if (!dbUser) {
      return Response.json({ error: 'ไม่พบบัญชีผู้ใช้' }, { status: 404 });
    }

    // bcrypt cost 12 + เก็บ hash หลักที่ users.password_hash (v4 ข้อ 4.2) — preferences เก็บคู่ไว้เพื่อบัญชีเดิม
    const pin_hash = bcrypt.hashSync(pin, 12);
    const pin_set_at = new Date().toISOString();
    const nextVer = flow.purpose === 'register' ? (dbUser.session_version ?? 0) : (dbUser.session_version ?? 0) + 1;

    await sbUpdate('users', { id: `eq.${flow.userId}` }, {
      password_hash: pin_hash,
      session_version: nextVer,
      ...(flow.purpose === 'register' ? { is_active: true } : {}),
      updated_at: pin_set_at,
    });
    const prefs: PinPrefs = {
      ...(profile?.preferences ?? {}),
      pin_hash,
      pin_set_at,
      pin_max_age_days: MAX_PIN_AGE_DAYS,
    };
    if (profile) {
      await sbUpdate('customer_profiles', { id: `eq.${profile.id}` }, { preferences: prefs });
    } else {
      await sbInsert('customer_profiles', {
        id: crypto.randomUUID(),
        user_id: flow.userId,
        preferences: prefs,
      });
    }

    let redirect = '/onboarding/biometric';
    if (flow.purpose !== 'register' && approvedTokenId) {
      await sbUpdate(
        'password_reset_tokens',
        { id: `eq.${approvedTokenId}`, status: 'eq.approved', used_at: 'is.null' },
        { used_at: new Date().toISOString(), status: 'used' },
      );
      redirect = '/';
    }

    const session = {
      id: flow.userId,
      email: flow.email,
      role: 'customer',
      fullName: flow.fullName,
      ver: nextVer,
    };
    const res = Response.json({ ok: true, next: redirect });
    res.headers.append('Set-Cookie', sessionCookieValue(serializeSession(session)));
    res.headers.append('Set-Cookie', clearNamedCookieValue(PENDING_COOKIE));
    return res;
  } catch (err) {
    console.error('onboard/pin error:', err);
    return Response.json({ error: 'ตั้ง PIN ไม่สำเร็จ กรุณาลองใหม่' }, { status: 500 });
  }
}
