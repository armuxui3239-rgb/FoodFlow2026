import 'server-only';
import crypto from 'crypto';

const SECRET = process.env.SESSION_SECRET || 'food-thunder-dev-secret';

export interface SessionUser {
  id: string;
  email: string;
  role: string;
  fullName: string;
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
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  };
}

export function orderCode(): string {
  const d = new Date();
  const ymd = `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const rand = crypto.randomBytes(2).toString('hex').toUpperCase();
  return `FT${ymd}${rand}`;
}
