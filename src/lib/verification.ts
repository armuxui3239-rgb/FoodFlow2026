import 'server-only';

/**
 * ช่องทางส่งรหัสยืนยัน (OTP) — ตามแพตช์ v3.1 ข้อ 3
 *
 * - production  = sms_gateway_selfhosted (SMS Gateway for Android™ บนเซิร์ฟเวอร์ส่วนตัว)
 * - development = dev_console (พิมพ์โค้ดลง console/log เท่านั้น ห้ามใช้ใน production)
 *
 * กฎ v2 D.4–D.5: รหัส 6 หลัก, หมดอายุ 300 วินาที, ผิดได้ 5 ครั้ง,
 * จำกัดการส่งซ้ำ 55 วินาที — ตรวจใน route (otp/send, otp/verify)
 */

export type DeliveryChannel = 'dev_console' | 'sms_gateway_selfhosted';

export interface OtpDeliveryResult {
  ok: boolean;
  /** id ข้อความฝั่งผู้ให้บริการ (sms gateway) ไว้ตรวจสอบย้อนหลัง */
  providerMessageId?: string;
  /** ใช้ได้เฉพาะ dev_console — ห้ามเปิดใน production */
  devCode?: string;
  error?: string;
}

export interface VerificationDelivery {
  readonly channel: DeliveryChannel;
  /** ส่ง SMS จริงไปยังเบอร์ผู้สมัคร (รูปแบบ 0xxxxxxxxx) */
  sendOtp(phone: string, code: string, purpose: 'register' | 'reset_pin'): Promise<OtpDeliveryResult>;
}

const OTP_TEXT: Record<'register' | 'reset_pin', (code: string) => string> = {
  register: (code) => `รหัสยืนยันสมัคร Food Thunder คือ ${code} (หมดอายุ 5 นาที) ห้ามบอกใคร`,
  reset_pin: (code) => `รหัสตั้ง PIN ใหม่ Food Thunder คือ ${code} (หมดอายุ 5 นาที) ห้ามบอกใคร`,
};

/** พัฒนา: พิมพ์โค้ดลง server console — ไม่ส่ง SMS จริง */
export const devConsoleDelivery: VerificationDelivery = {
  channel: 'dev_console',
  async sendOtp(phone, code, purpose) {
    console.info(`[dev_console] OTP ${purpose} → ${phone}: ${code}`);
    return { ok: true, devCode: code };
  },
};

/** ผลิตจริง: SMS Gateway for Android™ self-hosted (โอเพนซอร์ส Apache-2.0) */
export const smsGatewaySelfHostedDelivery: VerificationDelivery = {
  channel: 'sms_gateway_selfhosted',
  async sendOtp(phone, code, purpose) {
    const base = process.env.SMS_GATE_URL;
    const user = process.env.SMS_GATE_USER;
    const password = process.env.SMS_GATE_PASSWORD;
    if (!base || !user || !password) {
      return { ok: false, error: 'SMS_GATE_URL/SMS_GATE_USER/SMS_GATE_PASSWORD ยังไม่ได้ตั้งค่า' };
    }
    // รูปแบบเบอร์ที่เกตเวย์คาดหวัง: นานาชาติแบบมี + เช่น +66812345678
    const e164 = phone.startsWith('0') ? `+66${phone.slice(1)}` : `+${phone}`;
    try {
      const res = await fetch(`${base.replace(/\/$/, '')}/api/3rdparty/v1/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${Buffer.from(`${user}:${password}`).toString('base64')}`,
        },
        body: JSON.stringify({
          textMessage: { text: OTP_TEXT[purpose](code), expiresAt: 0 },
          phoneNumbers: [e164],
        }),
        cache: 'no-store',
      });
      if (!res.ok) {
        return { ok: false, error: `sms gateway ${res.status}: ${(await res.text()).slice(0, 200)}` };
      }
      const body = (await res.json()) as { id?: string };
      return { ok: true, providerMessageId: body.id };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'sms gateway unreachable' };
    }
  },
};

/** เลือกช่องทางจาก env — production ห้ามใช้ dev_console เด็ดขาด */
export function getVerificationDelivery(): VerificationDelivery {
  const channel = (process.env.VERIFICATION_DELIVERY ?? 'dev_console') as DeliveryChannel;
  const isProd = process.env.NODE_ENV === 'production';
  if (channel === 'sms_gateway_selfhosted') return smsGatewaySelfHostedDelivery;
  if (isProd) {
    throw new Error('production ห้ามใช้ VERIFICATION_DELIVERY=dev_console — ตั้งเป็น sms_gateway_selfhosted พร้อม SMS_GATE_* ก่อน');
  }
  return devConsoleDelivery;
}

export function getDeliveryChannel(): DeliveryChannel {
  const channel = (process.env.VERIFICATION_DELIVERY ?? 'dev_console') as DeliveryChannel;
  return channel === 'sms_gateway_selfhosted' ? 'sms_gateway_selfhosted' : 'dev_console';
}
