import 'server-only';
import crypto from 'crypto';

const SECRET = process.env.SESSION_SECRET || 'food-thunder-dev-secret';

export interface SessionUser {
  id: string;
  email: string;
  role: string;
  fullName: string;
  /** เวอร์ชัน session ของบัญชี ณ ตอนลงชื่อ — logout/เปลี่ยน PIN/ลบบัญชี ยกเวอร์ชัน เพื่อเพิกถอน session เก่า */
  ver: number;
}

function sign(value: string): string {
  return crypto.createHmac('sha256', SECRET).update(value).digest('base64url');
}

export function serializeSession(user: SessionUser): string {
  const payload = Buffer.from(JSON.stringify(user)).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

export function parseSession(token: string | undefined): SessionUser | null {
  if (!token) return null;
  const [payload, sig] = token.split('.');
  if (!payload || !sig || sign(payload) !== sig) return null;
  try {
    return JSON.parse(Buffer.from(payload, 'base64url').toString()) as SessionUser;
  } catch {
    return null;
  }
}

export const SESSION_COOKIE = 'ft_session';

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    // Secure เฉพาะ production — localhost (http) ของโหมดพัฒนายังใช้ได้
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  };
}

/** สร้างค่า header Set-Cookie ของ ft_session — ใช้ค่าจาก sessionCookieOptions() ครบทุก flag
 *  (จุดเดียวของระบบ — ห้ามสร้าง string เองที่ route อื่น ไม่งั้น flag Secure หลุดบน production) */
export function sessionCookieValue(token: string, maxAgeOverride?: number): string {
  const opt = sessionCookieOptions();
  const maxAge = maxAgeOverride ?? opt.maxAge;
  const flags = [`Path=${opt.path}`, `Max-Age=${maxAge}`, 'HttpOnly', 'SameSite=Lax'];
  if (opt.secure) flags.push('Secure');
  return `${SESSION_COOKIE}=${token}; ${flags.join('; ')}`;
}

/** ล้าง ft_session — flag เดียวกันกับตอน set เสมอ */
export function clearSessionCookieValue(): string {
  const opt = sessionCookieOptions();
  const flags = [`Path=${opt.path}`, 'Max-Age=0', 'HttpOnly', 'SameSite=Lax'];
  if (opt.secure) flags.push('Secure');
  return `${SESSION_COOKIE}=; ${flags.join('; ')}`;
}

/** สร้าง/ล้างค่า Set-Cookie ของ cookie อื่น (เช่น ft_pending) — ตาม options ที่ผู้เรียกส่ง + Secure บน production */
export function namedCookieValue(name: string, token: string, opts: { path: string; maxAge: number }): string {
  const flags = [`Path=${opts.path}`, `Max-Age=${opts.maxAge}`, 'HttpOnly', 'SameSite=Lax'];
  if (process.env.NODE_ENV === 'production') flags.push('Secure');
  return `${name}=${token}; ${flags.join('; ')}`;
}

export function clearNamedCookieValue(name: string, path = '/'): string {
  const flags = [`Path=${path}`, 'Max-Age=0', 'HttpOnly', 'SameSite=Lax'];
  if (process.env.NODE_ENV === 'production') flags.push('Secure');
  return `${name}=; ${flags.join('; ')}`;
}

export function orderCode(): string {
  const d = new Date();
  const ymd = `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const rand = crypto.randomBytes(2).toString('hex').toUpperCase();
  return `FT${ymd}${rand}`;
}
