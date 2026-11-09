import 'server-only';
import { cookies } from 'next/headers';
import { parseSession, SessionUser, SESSION_COOKIE } from '@/lib/session';

export async function currentUser(): Promise<SessionUser | null> {
  const store = await cookies();
  return parseSession(store.get(SESSION_COOKIE)?.value);
}

export function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}
