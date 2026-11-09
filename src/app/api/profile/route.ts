import { NextRequest } from 'next/server';
import { sbList, sbOne, sbUpdate } from '@/lib/supabase';
import { currentUser, jsonError } from '@/lib/api-user';

interface UserRow {
  id: string;
  email: string;
  phone: string | null;
  full_name: string;
  avatar_url: string | null;
  preferred_locale: string | null;
  phone_verified_at: string | null;
  created_at: string;
}

interface CustomerProfile {
  total_orders: number;
  default_address_id: string | null;
}

/** GET — ข้อมูลโปรไฟล์ของผู้ใช้ปัจจุบัน (users + สถิติลูกค้า + ที่อยู่ตั้งต้น) */
export async function GET() {
  const user = await currentUser();
  if (!user) return jsonError('กรุณาเข้าสู่ระบบ', 401);

  const u = await sbOne<UserRow>('users', {
    id: `eq.${user.id}`,
    select: 'id,email,phone,full_name,avatar_url,preferred_locale,phone_verified_at,created_at',
  });
  if (!u) return jsonError('ไม่พบบัญชีผู้ใช้', 404);

  const cp = await sbOne<CustomerProfile>('customer_profiles', {
    user_id: `eq.${user.id}`,
    select: 'total_orders,default_address_id',
  });
  const defaultAddr = cp?.default_address_id
    ? await sbOne<{ id: string; label: string; address_line: string }>('addresses', {
        id: `eq.${cp.default_address_id}`,
        select: 'id,label,address_line',
      })
    : null;

  return Response.json({
    data: {
      id: u.id,
      email: u.email,
      phone: u.phone,
      fullName: u.full_name,
      avatarUrl: u.avatar_url,
      locale: u.preferred_locale ?? 'th',
      phoneVerified: Boolean(u.phone_verified_at),
      memberSince: u.created_at,
      totalOrders: cp?.total_orders ?? 0,
      defaultAddress: defaultAddr,
    },
  });
}

/** PATCH — แก้ชื่อ/อีเมล/รูปโปรไฟล์ (เบอร์โทรเปลี่ยนไม่ได้ที่นี่ เพราะผูก OTP) */
export async function PATCH(req: NextRequest) {
  const user = await currentUser();
  if (!user) return jsonError('กรุณาเข้าสู่ระบบ', 401);

  const { fullName, email, avatarUrl } = (await req.json().catch(() => ({}))) as {
    fullName?: string;
    email?: string;
    avatarUrl?: string | null;
  };

  const body: Record<string, string | null> = { updated_at: new Date().toISOString() };
  if (fullName !== undefined) {
    const name = fullName.trim();
    if (name.length < 2) return jsonError('กรุณากรอกชื่อ-นามสกุลอย่างน้อย 2 ตัวอักษร', 400);
    body.full_name = name;
  }
  if (email !== undefined) {
    const clean = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) return jsonError('รูปแบบอีเมลไม่ถูกต้อง', 400);
    // อีเมลต้องไม่ซ้ำกับบัญชีอื่น
    const dup = await sbList<{ id: string }>('users', {
      email: `eq.${clean}`,
      select: 'id',
    });
    if (dup.some((d) => d.id !== user.id)) return jsonError('อีเมลนี้ถูกใช้โดยบัญชีอื่นแล้ว', 409);
    body.email = clean;
  }
  if (avatarUrl !== undefined) {
    body.avatar_url = avatarUrl?.trim() ? avatarUrl.trim() : null;
  }

  const [row] = await sbUpdate<UserRow>('users', { id: `eq.${user.id}` }, body);
  return Response.json({
    data: {
      id: row.id,
      email: row.email,
      fullName: row.full_name,
      avatarUrl: row.avatar_url,
    },
  });
}
