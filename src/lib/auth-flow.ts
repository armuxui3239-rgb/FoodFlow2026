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
