import { NextRequest } from 'next/server';
import crypto from 'crypto';
import { cookies } from 'next/headers';
import { sbOne, sbList, sbUpdate, sbInsert } from '@/lib/supabase';
import { PENDING_COOKIE, parsePending } from '@/lib/auth-flow';

interface ProfilePrefs {
  nickname?: string;
  birth_date?: string;
  gender?: string;
  [key: string]: unknown;
}

interface CustomerProfile {
  id: string;
  user_id: string;
  preferences: ProfilePrefs | null;
}

/** GET — ดึงข้อมูลที่กรอกไว้ตอนสมัคร (ชื่อ-นามสกุล, อีเมล, รูป, preferences) มาแสดงในฟอร์ม onboarding */
export async function GET() {
  try {
    const cookieStore = await cookies();
    const flow = parsePending(cookieStore.get(PENDING_COOKIE)?.value);
    if (!flow || flow.purpose !== 'register') {
      return Response.json({ error: 'หมดเวลาดำเนินการ กรุณาเริ่มใหม่' }, { status: 401 });
    }
    const u = await sbOne<{ full_name: string | null; email: string; avatar_url: string | null }>('users', {
      id: `eq.${flow.userId}`,
      select: 'full_name,email,avatar_url',
    });
    const profile = await sbOne<CustomerProfile>('customer_profiles', {
      user_id: `eq.${flow.userId}`,
      select: 'id,user_id,preferences',
    });
    const prefs = profile?.preferences ?? {};
    return Response.json({
      data: {
        fullName: u?.full_name ?? '',
        email: u?.email ?? flow.email ?? '',
        avatarUrl: u?.avatar_url ?? '',
        nickname: prefs.nickname ?? '',
        birthDate: prefs.birth_date ?? '',
        gender: prefs.gender ?? '',
      },
    });
  } catch (err) {
    console.error('onboard/profile GET error:', err);
    return Response.json({ error: 'โหลดข้อมูลไม่สำเร็จ' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const flow = parsePending(cookieStore.get(PENDING_COOKIE)?.value);
    if (!flow || flow.purpose !== 'register') {
      return Response.json({ error: 'หมดเวลาดำเนินการ กรุณาเริ่มใหม่' }, { status: 401 });
    }
    const { fullName, nickname, birthDate, gender, email } = (await req.json()) as {
      fullName?: string;
      nickname?: string;
      birthDate?: string;
      gender?: string;
      email?: string;
    };
    if (!fullName || fullName.trim().length < 2) {
      return Response.json({ error: 'กรุณากรอกชื่อ-นามสกุล' }, { status: 400 });
    }
    const cleanEmail = (email ?? '').trim().toLowerCase();
    if (cleanEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return Response.json({ error: 'รูปแบบอีเมลไม่ถูกต้อง' }, { status: 400 });
    }
    if (cleanEmail && cleanEmail !== flow.email.toLowerCase()) {
      const dup = await sbList<{ id: string }>('users', { email: `eq.${cleanEmail}`, select: 'id' });
      if (dup.some((u) => u.id !== flow.userId)) {
        return Response.json({ error: 'อีเมลนี้ถูกใช้แล้ว' }, { status: 409 });
      }
    }

    await sbUpdate('users', { id: `eq.${flow.userId}` }, {
      full_name: fullName.trim(),
      ...(cleanEmail ? { email: cleanEmail } : {}),
      updated_at: new Date().toISOString(),
    });

    // เก็บรายละเอียดโปรไฟล์เพิ่มเติมใน customer_profiles.preferences
    const profile = await sbOne<CustomerProfile>('customer_profiles', {
      user_id: `eq.${flow.userId}`,
      select: 'id,user_id,preferences',
    });
    const prefs: ProfilePrefs = {
      ...(profile?.preferences ?? {}),
      nickname: (nickname ?? '').trim() || undefined,
      birth_date: birthDate || undefined,
      gender: gender || undefined,
    };
    if (profile) {
      await sbUpdate('customer_profiles', { id: `eq.${profile.id}` }, { preferences: prefs });
    } else {
      await sbInsert('customer_profiles', {
        id: crypto.randomUUID(),
        user_id: flow.userId,
        preferences: prefs,
      });
    }

    return Response.json({ ok: true, next: '/onboarding/location' });
  } catch (err) {
    console.error('onboard/profile error:', err);
    return Response.json({ error: 'บันทึกโปรไฟล์ไม่สำเร็จ กรุณาลองใหม่' }, { status: 500 });
  }
}
