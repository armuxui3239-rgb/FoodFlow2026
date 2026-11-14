import { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import { sbOne, sbUpdate } from '@/lib/supabase';
import { PENDING_COOKIE, newPendingFlow, serializePending, pendingCookieOptions } from '@/lib/auth-flow';

interface OtpRow {
  id: string;
  user_id: string;
  purpose: string;
  code_hash: string;
  expires_at: string;
  attempts: number;
  consumed_at: string | null;
}

interface DbUser {
  id: string;
  email: string;
  phone: string | null;
  full_name: string | null;
}

const MAX_ATTEMPTS = 5;

export async function POST(req: NextRequest) {
  try {
    const { otpId, code } = (await req.json()) as { otpId?: string; code?: string };
    if (!otpId || !code || !/^\d{6}$/.test(code)) {
      return Response.json({ error: 'กรุณากรอกรหัส OTP 6 หลัก' }, { status: 400 });
    }
    const otp = await sbOne<OtpRow>('otp_codes', {
      id: `eq.${otpId}`,
      select: 'id,user_id,purpose,code_hash,expires_at,attempts,consumed_at',
    });
    if (!otp || otp.consumed_at) {
      return Response.json({ error: 'รหัสหมดอายุ กรุณาขอรหัสใหม่' }, { status: 400 });
    }
    if (new Date(otp.expires_at).getTime() < Date.now()) {
      return Response.json({ error: 'รหัสหมดอายุ กรุณาขอรหัสใหม่' }, { status: 400 });
    }
    if (otp.attempts >= MAX_ATTEMPTS) {
      // เกิน 5 ครั้ง → ยกเลิกรหัสทันที (v4 ข้อ 4.3)
      await sbUpdate('otp_codes', { id: `eq.${otp.id}`, consumed_at: 'is.null' }, { consumed_at: new Date().toISOString() });
      return Response.json({ error: 'กรอกผิดครบ 5 ครั้ง กรุณาขอรหัสใหม่' }, { status: 423 });
    }
    if (!bcrypt.compareSync(code, otp.code_hash)) {
      // นับพลาดแบบ atomic — update โดยกำหนด attempts = ค่าที่อ่านล่าสุด กันคำขอพร้อมกันข้ามขั้น
      let current = otp.attempts;
      for (let i = 0; i < 3; i += 1) {
        const updated = await sbUpdate<{ attempts: number }>(
          'otp_codes',
          { id: `eq.${otp.id}`, attempts: `eq.${current}` },
          { attempts: current + 1 },
        );
        if (updated.length > 0) {
          current += 1;
          break;
        }
        const fresh = await sbOne<{ attempts: number }>('otp_codes', {
          id: `eq.${otp.id}`,
          select: 'attempts',
        });
        if (!fresh) break;
        current = fresh.attempts;
      }
      if (current >= MAX_ATTEMPTS) {
        await sbUpdate('otp_codes', { id: `eq.${otp.id}`, consumed_at: 'is.null' }, { consumed_at: new Date().toISOString() });
        return Response.json({ error: 'กรอกผิดครบ 5 ครั้ง กรุณาขอรหัสใหม่' }, { status: 423 });
      }
      return Response.json(
        { error: `รหัสไม่ถูกต้อง (พยายามได้อีก ${MAX_ATTEMPTS - current} ครั้ง)` },
        { status: 400 },
      );
    }

    const user = await sbOne<DbUser>('users', {
      id: `eq.${otp.user_id}`,
      select: 'id,email,phone,full_name',
    });
    if (!user) {
      return Response.json({ error: 'ไม่พบบัญชีผู้ใช้' }, { status: 404 });
    }

    await sbUpdate('otp_codes', { id: `eq.${otp.id}` }, { consumed_at: new Date().toISOString() });

    if (otp.purpose === 'register') {
      await sbUpdate('users', { id: `eq.${user.id}` }, {
        phone_verified_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }

    const flow = newPendingFlow({
      userId: user.id,
      phone: user.phone ?? '',
      email: user.email,
      fullName: user.full_name ?? '',
      purpose: otp.purpose as 'register' | 'reset_pin',
    });

    const res = Response.json({ ok: true, purpose: otp.purpose });
    const opt = pendingCookieOptions();
    res.headers.append(
      'Set-Cookie',
      `${PENDING_COOKIE}=${serializePending(flow)}; Path=${opt.path}; Max-Age=${opt.maxAge}; HttpOnly; SameSite=Lax`,
    );
    return res;
  } catch (err) {
    console.error('otp/verify error:', err);
    return Response.json({ error: 'ตรวจสอบรหัสไม่สำเร็จ กรุณาลองใหม่' }, { status: 500 });
  }
}
