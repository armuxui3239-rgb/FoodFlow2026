import { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { sbList, sbInsert, sbUpdate } from '@/lib/supabase';
import { normalizePhone, maskPhone } from '@/lib/auth-flow';
import { getVerificationDelivery, getDeliveryChannel } from '@/lib/verification';

interface DbUser {
  id: string;
  email: string;
  phone: string | null;
  full_name: string | null;
  is_active: boolean;
  phone_verified_at: string | null;
}

interface OtpRow {
  id: string;
  expires_at: string;
}

const OTP_TTL_SEC = 300;
const RESEND_COOLDOWN_SEC = 55;

export async function POST(req: NextRequest) {
  try {
    const { phone: rawPhone, purpose, email, fullName } = (await req.json()) as {
      phone?: string;
      purpose?: string;
      email?: string;
      fullName?: string;
    };
    const phone = normalizePhone(rawPhone ?? '');
    if (!phone) {
      return Response.json({ error: 'เบอร์โทรไม่ถูกต้อง (ต้องเป็นเบอร์ไทย เช่น 0812345678)' }, { status: 400 });
    }
    if (purpose !== 'register' && purpose !== 'reset_pin') {
      return Response.json({ error: 'คำขอไม่ถูกต้อง' }, { status: 400 });
    }
    const cleanEmail = (email ?? '').trim().toLowerCase();
    const cleanName = (fullName ?? '').trim();

    if (purpose === 'register') {
      if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
        return Response.json({ error: 'กรุณากรอกอีเมลให้ถูกต้อง' }, { status: 400 });
      }
      if (cleanName.length < 2) {
        return Response.json({ error: 'กรุณากรอกชื่อ-นามสกุล' }, { status: 400 });
      }
      // มีบัญชีที่ยืนยันแล้วด้วยเบอร์นี้ → ให้เข้าสู่ระบบแทน
      const active = await sbList<DbUser>('users', {
        phone: `eq.${phone}`,
        role: 'eq.customer',
        is_active: 'eq.true',
        select: 'id,email,phone,full_name,is_active,phone_verified_at',
      });
      if (active.length > 0) {
        return Response.json(
          { error: 'เบอร์นี้สมัครไว้แล้ว กรุณาเข้าสู่ระบบด้วย PIN' },
          { status: 409 },
        );
      }
      // อีเมลซ้ำกับบัญชีอื่น (ยกเว้นบัญชี pending ของเบอร์นี้เอง)
      const byEmail = await sbList<DbUser>('users', {
        email: `eq.${cleanEmail}`,
        select: 'id,email,phone,full_name,is_active,phone_verified_at',
      });
      if (byEmail.some((u) => u.phone !== phone)) {
        return Response.json({ error: 'อีเมลนี้ถูกใช้แล้ว กรุณาใช้อีเมลอื่น' }, { status: 409 });
      }
      // สร้าง/ใช้บัญชีรอยืนยัน
      const pending = await sbList<DbUser>('users', {
        phone: `eq.${phone}`,
        role: 'eq.customer',
        is_active: 'eq.false',
        select: 'id,email,phone,full_name,is_active,phone_verified_at',
      });
      if (pending[0]) {
        await sbUpdate('users', { id: `eq.${pending[0].id}` }, {
          email: cleanEmail,
          full_name: cleanName,
          updated_at: new Date().toISOString(),
        });
      } else {
        await sbInsert('users', {
          email: cleanEmail,
          phone,
          password_hash: bcrypt.hashSync(crypto.randomUUID(), 10),
          full_name: cleanName,
          role: 'customer',
          is_active: false,
          // enum "LocaleCode" ใน Supabase ยังไม่มี 'th' (พิสูจน์จาก error 22P02 จริง)
          // รัน deployments/sql/add_th_locale.sql แล้วตั้ง USER_LOCALE_DEFAULT=th ใน .env
          preferred_locale: process.env.USER_LOCALE_DEFAULT ?? 'en',
        });
      }
    } else {
      // reset_pin: ต้องมีบัญชีจริงที่ยืนยันเบอร์แล้ว
      const users = await sbList<DbUser>('users', {
        phone: `eq.${phone}`,
        role: 'eq.customer',
        is_active: 'eq.true',
        phone_verified_at: 'not.is.null',
        select: 'id,email,phone,full_name,is_active,phone_verified_at',
      });
      if (!users[0]) {
        return Response.json({ error: 'ไม่พบบัญชีที่ผูกกับเบอร์นี้' }, { status: 404 });
      }
    }

    const owner = await sbList<DbUser>('users', {
      phone: `eq.${phone}`,
      role: 'eq.customer',
      select: 'id,email,phone,full_name,is_active,phone_verified_at',
    });
    if (!owner[0]) {
      return Response.json({ error: 'ไม่พบบัญชีผู้ใช้' }, { status: 500 });
    }
    const userId = owner[0].id;

    // จำกัดการส่งซ้ำ: อายุของ OTP ล่าสุดที่ยังใช้ได้ ต้องเกิน cooldown
    const live = await sbList<OtpRow>('otp_codes', {
      user_id: `eq.${userId}`,
      purpose: `eq.${purpose}`,
      consumed_at: 'is.null',
      order: 'expires_at.desc',
      limit: '1',
      select: 'id,expires_at',
    });
    const latest = live[0];
    if (latest) {
      const createdMs = new Date(latest.expires_at).getTime() - OTP_TTL_SEC * 1000;
      const elapsedSec = Math.floor((Date.now() - createdMs) / 1000);
      if (elapsedSec >= 0 && elapsedSec < RESEND_COOLDOWN_SEC) {
        return Response.json(
          {
            error: `ขอรหัสซ้ำได้ในอีก ${RESEND_COOLDOWN_SEC - elapsedSec} วินาที`,
            resendInSec: RESEND_COOLDOWN_SEC - elapsedSec,
          },
          { status: 429 },
        );
      }
      // ยกเลิก OTP เดิมที่ยังไม่ใช้
      await sbUpdate(
        'otp_codes',
        { user_id: `eq.${userId}`, purpose: `eq.${purpose}`, consumed_at: 'is.null' },
        { consumed_at: new Date().toISOString() },
      );
    }

    // สร้าง OTP 6 หลัก — เก็บเป็น hash เท่านั้น
    const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
    const expiresAt = new Date(Date.now() + OTP_TTL_SEC * 1000).toISOString();
    const [otp] = await sbInsert<{ id: string }>('otp_codes', {
      user_id: userId,
      purpose,
      code_hash: bcrypt.hashSync(code, 10),
      expires_at: expiresAt,
      attempts: 0,
    });

    // ส่งโค้ดผ่านช่องทางที่กำหนด (dev = dev_console, production = sms_gateway_selfhosted)
    const delivery = getVerificationDelivery();
    const sent = await delivery.sendOtp(phone, code, purpose);
    if (!sent.ok) {
      // ส่งไม่ถึงผู้ใช้ → ยกเลิกโค้ดที่เพิ่งออก ไม่ให้ใช้ได้
      await sbUpdate('otp_codes', { id: `eq.${otp.id}` }, { consumed_at: new Date().toISOString() });
      return Response.json(
        { error: 'ส่ง SMS ไม่สำเร็จ กรุณาลองอีกครั้งในภายหลัง', detail: sent.error },
        { status: 502 },
      );
    }

    return Response.json({
      otpId: otp.id,
      phoneMasked: maskPhone(phone),
      deliveryChannel: delivery.channel,
      // devCode มีเฉพาะ dev_console เท่านั้น — production ไม่มีค่านี้
      devCode: sent.devCode,
      expiresInSec: OTP_TTL_SEC,
      resendInSec: RESEND_COOLDOWN_SEC,
    });
  } catch (err) {
    console.error('otp/send error:', err);
    return Response.json(
      { error: err instanceof Error && err.message.includes('dev_console') ? err.message : 'ส่งรหัส OTP ไม่สำเร็จ กรุณาลองใหม่' },
      { status: 500 },
    );
  }
}
