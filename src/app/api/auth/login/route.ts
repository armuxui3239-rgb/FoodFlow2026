import { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import { sbOne, sbUpdate } from '@/lib/supabase';
import { serializeSession, sessionCookieOptions, SESSION_COOKIE } from '@/lib/session';

interface DbUser {
  id: string;
  email: string;
  password_hash: string;
  full_name: string;
  role: string;
  is_active: boolean;
  failed_login_count: number;
  locked_until: string | null;
}

const MAX_FAILED = 5;
const LOCK_MINUTES = 15;

export async function POST(req: NextRequest) {
  const { email, password } = (await req.json()) as { email?: string; password?: string };
  if (!email || !password) {
    return Response.json({ error: 'กรุณากรอกอีเมลและรหัสผ่าน' }, { status: 400 });
  }
  const user = await sbOne<DbUser>('users', {
    email: `eq.${email.trim().toLowerCase()}`,
    select: 'id,email,password_hash,full_name,role,is_active,failed_login_count,locked_until',
  });

  if (user?.locked_until && new Date(user.locked_until).getTime() > Date.now()) {
    const mins = Math.ceil((new Date(user.locked_until).getTime() - Date.now()) / 60000);
    return Response.json(
      { error: `บัญชีถูกล็อกชั่วคราว ลองอีกครั้งใน ${mins} นาที` },
      { status: 423 },
    );
  }

  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    // ล็อกบัญชีเมื่อพยายามผิดซ้ำ (เฟส 6 — เส้นอีเมลของพนักงาน/แอดมิน)
    if (user) {
      const count = (user.failed_login_count ?? 0) + 1;
      if (count >= MAX_FAILED) {
        const recentLock = user.locked_until && Date.now() - new Date(user.locked_until).getTime() < 60 * 60 * 1000;
        const lockMinutes = recentLock ? LOCK_MINUTES * 2 : LOCK_MINUTES;
        await sbUpdate('users', { id: `eq.${user.id}` }, {
          failed_login_count: 0,
          locked_until: new Date(Date.now() + lockMinutes * 60000).toISOString(),
          updated_at: new Date().toISOString(),
        });
        return Response.json(
          { error: `รหัสผ่านผิด ${MAX_FAILED} ครั้ง บัญชีถูกล็อก ${lockMinutes} นาที` },
          { status: 423 },
        );
      }
      await sbUpdate('users', { id: `eq.${user.id}` }, {
        failed_login_count: count,
        updated_at: new Date().toISOString(),
      });
    }
    return Response.json({ error: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' }, { status: 401 });
  }
  if (!user.is_active) {
    return Response.json({ error: 'บัญชีถูกระงับการใช้งาน' }, { status: 403 });
  }
  await sbUpdate('users', { id: `eq.${user.id}` }, {
    failed_login_count: 0,
    locked_until: null,
    updated_at: new Date().toISOString(),
  });
  const session = { id: user.id, email: user.email, role: user.role, fullName: user.full_name };
  const res = Response.json({ user: session });
  const opt = sessionCookieOptions();
  res.headers.append(
    'Set-Cookie',
    `${SESSION_COOKIE}=${serializeSession(session)}; Path=${opt.path}; Max-Age=${opt.maxAge}; HttpOnly; SameSite=Lax`,
  );
  return res;
}
