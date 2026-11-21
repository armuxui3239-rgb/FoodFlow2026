import 'server-only';

/**
 * ช่องทางรหัสยืนยัน (OTP) — ระบบภายใน (internal_code) ตาม OWNER-TRUTH-SHEET.md
 * ไม่มีบริการส่ง SMS ภายนอก
 */

export type DeliveryChannel = 'dev_console' | 'internal_code';

export interface OtpDeliveryResult {
  ok: boolean;
  devCode?: string;
  error?: string;
}

export interface VerificationDelivery {
  readonly channel: DeliveryChannel;
  sendOtp(phone: string, code: string, purpose: 'register' | 'reset_pin'): Promise<OtpDeliveryResult>;
}

/** พัฒนา: พิมพ์โค้ดลง server console */
export const devConsoleDelivery: VerificationDelivery = {
  channel: 'dev_console',
  async sendOtp(phone, code, purpose) {
    console.info(`[dev_console] OTP ${purpose} → ${phone}: ${code}`);
    return { ok: true, devCode: code };
  },
};

/**
 * รหัสยืนยันภายในระบบ — นโยบายเจ้าของโปรเจค: ไม่มีการส่ง SMS ออกภายนอกเลย
 * รหัสคืนให้เฉพาะ session ผู้ขอ (ผู้ใช้เห็นในหน้า verify-otp ของแอป)
 */
export const internalCodeDelivery: VerificationDelivery = {
  channel: 'internal_code',
  async sendOtp(phone, code, purpose) {
    console.info(`[internal_code] OTP ${purpose} → ${phone}: ${code} (แสดงในระบบเท่านั้น — ไม่มีการส่งออก)`);
    return { ok: true, devCode: code };
  },
};

/** เลือกช่องทางจาก env — ค่าเริ่มต้น internal_code; dev_console ห้ามใน production */
export function getVerificationDelivery(): VerificationDelivery {
  const channel = (process.env.VERIFICATION_DELIVERY ?? 'internal_code') as DeliveryChannel;
  const isProd = process.env.NODE_ENV === 'production';
  if (channel === 'internal_code') return internalCodeDelivery;
  if (isProd) {
    throw new Error('production ห้ามใช้ VERIFICATION_DELIVERY=dev_console — ตั้งเป็น internal_code');
  }
  return devConsoleDelivery;
}

export function getDeliveryChannel(): DeliveryChannel {
  const channel = (process.env.VERIFICATION_DELIVERY ?? 'internal_code') as DeliveryChannel;
  return channel === 'dev_console' ? 'dev_console' : 'internal_code';
}
