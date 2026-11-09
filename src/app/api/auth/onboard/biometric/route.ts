import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { sbOne, sbUpdate } from '@/lib/supabase';
import { PENDING_COOKIE, parsePending } from '@/lib/auth-flow';
import { parseSession, SESSION_COOKIE } from '@/lib/session';

interface PinPrefs {
  biometric_enabled?: boolean;
  [key: string]: unknown;
}

interface CustomerProfile {
  id: string;
  user_id: string;
  preferences: PinPrefs | null;
}

/** บันทึกค่ากำหนดไบโอเมตริก (ลายนิ้วมือ/ใบหน้า) — ใช้งานจริงบนอุปกรณ์ที่รองรับ WebAuthn */
export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    // กรณีมาจากขั้นตอนสมัคร (ยังมี pending) หรือเข้าสู่ระบบแล้ว (session หลัก)
    const pending = parsePending(cookieStore.get(PENDING_COOKIE)?.value);
    const session = parseSession(cookieStore.get(SESSION_COOKIE)?.value);
    const userId = pending?.userId ?? (session && session.role === 'customer' ? session.id : null);
    if (!userId) {
      return Response.json({ error: 'ไม่ได้เข้าสู่ระบบ' }, { status: 401 });
    }
    const { enabled } = (await req.json()) as { enabled?: boolean };

    const profile = await sbOne<CustomerProfile>('customer_profiles', {
      user_id: `eq.${userId}`,
      select: 'id,user_id,preferences',
    });
    if (profile) {
      await sbUpdate('customer_profiles', { id: `eq.${profile.id}` }, {
        preferences: { ...(profile.preferences ?? {}), biometric_enabled: Boolean(enabled) },
      });
    }

    return Response.json({ ok: true, next: '/onboarding/welcome' });
  } catch (err) {
    console.error('onboard/biometric error:', err);
    return Response.json({ error: 'บันทึกไม่สำเร็จ กรุณาลองใหม่' }, { status: 500 });
  }
}
