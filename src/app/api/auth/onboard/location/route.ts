import { NextRequest } from 'next/server';
import crypto from 'crypto';
import { cookies } from 'next/headers';
import { sbOne, sbList, sbUpdate, sbInsert } from '@/lib/supabase';
import { PENDING_COOKIE, parsePending } from '@/lib/auth-flow';

interface CustomerProfile {
  id: string;
  user_id: string;
  default_address_id: string | null;
}

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const flow = parsePending(cookieStore.get(PENDING_COOKIE)?.value);
    if (!flow || flow.purpose !== 'register') {
      return Response.json({ error: 'หมดเวลาดำเนินการ กรุณาเริ่มใหม่' }, { status: 401 });
    }
    const { label, addressLine, lat, lng } = (await req.json()) as {
      label?: string;
      addressLine?: string;
      lat?: number;
      lng?: number;
    };
    if (!addressLine || addressLine.trim().length < 5) {
      return Response.json({ error: 'กรุณากรอกที่อยู่ให้ครบถ้วน' }, { status: 400 });
    }
    if (typeof lat !== 'number' || typeof lng !== 'number' || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
      return Response.json({ error: 'กรุณาระบุจุดบนแผนที่' }, { status: 400 });
    }
    const cleanLabel = (label ?? 'บ้าน').trim() || 'บ้าน';
    const payload = {
      label: cleanLabel,
      address_line: addressLine.trim(),
      location: `SRID=4326;POINT(${lng} ${lat})`,
      is_default: true,
    };

    // 1 ที่อยู่หลักต่อผู้ใช้ (unique index) — อัปเดตถ้ามีอยู่แล้ว
    const existing = await sbList<{ id: string }>('addresses', {
      user_id: `eq.${flow.userId}`,
      is_default: 'eq.true',
      select: 'id',
    });
    let addressId: string;
    if (existing[0]) {
      const [row] = await sbUpdate<{ id: string }>(
        'addresses',
        { id: `eq.${existing[0].id}` },
        payload,
      );
      addressId = row.id;
    } else {
      const [row] = await sbInsert<{ id: string }>('addresses', {
        user_id: flow.userId,
        ...payload,
      });
      addressId = row.id;
    }

    const profile = await sbOne<CustomerProfile>('customer_profiles', {
      user_id: `eq.${flow.userId}`,
      select: 'id,user_id,default_address_id',
    });
    if (profile) {
      await sbUpdate('customer_profiles', { id: `eq.${profile.id}` }, { default_address_id: addressId });
    } else {
      await sbInsert('customer_profiles', {
        id: crypto.randomUUID(),
        user_id: flow.userId,
        default_address_id: addressId,
      });
    }

    return Response.json({ ok: true, next: '/onboarding/pin' });
  } catch (err) {
    console.error('onboard/location error:', err);
    return Response.json({ error: 'บันทึกที่อยู่ไม่สำเร็จ กรุณาลองใหม่' }, { status: 500 });
  }
}
