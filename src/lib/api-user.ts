import 'server-only';
import { cookies } from 'next/headers';
import { parseSession, SessionUser, SESSION_COOKIE } from '@/lib/session';
import { sbOne } from '@/lib/supabase';

export async function currentUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const session = parseSession(store.get(SESSION_COOKIE)?.value);
  if (!session) return null;

  // เพิกถอนฝั่งเซิร์ฟเวอร์: บัญชีต้องยังเปิดใช้งาน + เวอร์ชัน session ตรง
  // (logout / เปลี่ยน PIN / ลบบัญชี ยก session_version → cookie เก่าตายทันที)
  const row = await sbOne<{ id: string; is_active: boolean; session_version: number }>('users', {
    id: `eq.${session.id}`,
    select: 'id,is_active,session_version',
  });
  if (!row || !row.is_active) return null;
  if ((row.session_version ?? 0) !== (session.ver ?? 0)) return null;
  return { ...session, ver: row.session_version ?? 0 };
}

export function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}
