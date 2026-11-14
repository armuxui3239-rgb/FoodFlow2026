import 'server-only';
import crypto from 'crypto';

const SECRET = process.env.SESSION_SECRET || 'food-thunder-dev-secret';

export const PENDING_COOKIE = 'ft_pending';

export interface PendingFlow {
  userId: string;
  phone: string;
  email: string;
  fullName: string;
  purpose: 'register' | 'reset_pin';
  exp: number;
}

function sign(value: string): string {
  return crypto.createHmac('sha256', SECRET).update(value).digest('base64url');
}

export function serializePending(flow: PendingFlow): string {
  const payload = Buffer.from(JSON.stringify(flow)).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

export function parsePending(token: string | undefined): PendingFlow | null {
  if (!token) return null;
  const [payload, sig] = token.split('.');
  if (!payload || !sig || sign(payload) !== sig) return null;
  try {
    const flow = JSON.parse(Buffer.from(payload, 'base64url').toString()) as PendingFlow;
    if (!flow.userId || flow.exp < Date.now()) return null;
    if (flow.purpose !== 'register' && flow.purpose !== 'reset_pin') return null;
    return flow;
  } catch {
    return null;
  }
}

export function newPendingFlow(
  base: Omit<PendingFlow, 'exp'>,
): PendingFlow {
  return { ...base, exp: Date.now() + 30 * 60 * 1000 };
}

export function pendingCookieOptions() {
  return { httpOnly: true, sameSite: 'lax' as const, path: '/', maxAge: 60 * 30 };
}

/** ปกติเบอร์ไทย: 66xxxxxxxxx → 0xxxxxxxxx (10 หลัก) */
export function normalizePhone(raw: string): string | null {
  const digits = (raw ?? '').replace(/\D/g, '');
  let p = digits;
  if (p.startsWith('66') && p.length >= 10) p = `0${p.slice(2)}`;
  if (!/^0\d{8,9}$/.test(p)) return null;
  return p;
}

export function maskPhone(p: string): string {
  if (p.length < 6) return p;
  return `${p.slice(0, 3)}****${p.slice(-3)}`;
}

/** ตรวจ PIN ที่เดาง่าย (v4 ข้อ 4.5): เลขซ้ำทั้งชุด · เรียงขึ้น/ลงต่อเนื่อง · ตรงวันเกิดของผู้ใช้
 *  คืนข้อความเหตุผลถ้าอ่อน หรือ null ถ้าผ่าน */
export function isWeakPin(pin: string, birthDate?: string | null): string | null {
  if (new RegExp(`^(${pin[0]}){6}$`).test(pin)) {
    return 'PIN ไม่ควรเป็นเลขซ้ำกันทั้ง 6 หลัก (เช่น 111111)';
  }
  const digits = pin.split('').map(Number);
  const asc = digits.every((d, i) => i === 0 || d === digits[i - 1] + 1);
  const desc = digits.every((d, i) => i === 0 || d === digits[i - 1] - 1);
  if (asc || desc) {
    return 'PIN ไม่ควรเรียงต่อเนื่อง (เช่น 123456 หรือ 654321)';
  }
  if (birthDate) {
    const d = new Date(birthDate);
    if (!Number.isNaN(d.getTime())) {
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const candidates = [
        `${dd}${mm}${String(d.getFullYear()).slice(-2)}`,
        `${dd}${mm}${d.getFullYear()}`,
        `${dd}${mm}${d.getFullYear() + 543}`,
      ];
      if (candidates.includes(pin)) return 'PIN ไม่ควรเป็นวันเกิดของคุณ';
    }
  }
  return null;
}
