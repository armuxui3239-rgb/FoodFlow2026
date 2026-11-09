import { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import { sbOne } from '@/lib/supabase';
import { serializeSession, sessionCookieOptions, SESSION_COOKIE } from '@/lib/session';

interface DbUser {
  id: string;
  email: string;
  password_hash: string;
  full_name: string;
  role: string;
  is_active: boolean;
}

export async function POST(req: NextRequest) {
  const { email, password } = (await req.json()) as { email?: string; password?: string };
  if (!email || !password) {
    return Response.json({ error: 'กรุณากรอกอีเมลและรหัสผ่าน' }, { status: 400 });
  }
  const user = await sbOne<DbUser>('users', {
    email: `eq.${email.trim().toLowerCase()}`,
    select: 'id,email,password_hash,full_name,role,is_active',
  });
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return Response.json({ error: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' }, { status: 401 });
  }
  if (!user.is_active) {
    return Response.json({ error: 'บัญชีถูกระงับการใช้งาน' }, { status: 403 });
  }
  const session = { id: user.id, email: user.email, role: user.role, fullName: user.full_name };
  const res = Response.json({ user: session });
  const opt = sessionCookieOptions();
  res.headers.append(
    'Set-Cookie',
    `${SESSION_COOKIE}=${serializeSession(session)}; Path=${opt.path}; Max-Age=${opt.maxAge}; HttpOnly; SameSite=Lax`,
  );
  return res;
}
