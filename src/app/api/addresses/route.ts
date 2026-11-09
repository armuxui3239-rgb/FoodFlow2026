import { NextRequest } from 'next/server';
import { sbInsert, sbList, sbUpdate } from '@/lib/supabase';
import { currentUser, jsonError } from '@/lib/api-user';

export interface AddressRow {
  id: string;
  label: string;
  address_line: string;
  location: unknown;
  is_default: boolean;
  created_at: string;
}

interface AddressInput {
  label?: string;
  addressLine?: string;
  isDefault?: boolean;
}

/** ตรวจและทำความสะอาดข้อมูลที่อยู่ — คืนข้อความผิดพลาดถ้าไม่ผ่าน */
function validate(body: AddressInput): { label: string; addressLine: string } | string {
  const label = (body.label ?? '').trim();
  const addressLine = (body.addressLine ?? '').trim();
  if (!label) return 'กรุณาเลือกชื่อป้ายที่อยู่';
  if (addressLine.length < 10) return 'กรุณากรอกที่อยู่อย่างน้อย 10 ตัวอักษร';
  return { label, addressLine };
}

/** ตั้งทุกที่อยู่ของผู้ใช้เป็นไม่ใช่ค่าเริ่มต้น (ทำก่อนตั้งอันใหม่) */
async function clearDefault(userId: string) {
  await sbUpdate('addresses', { user_id: `eq.${userId}`, is_default: 'eq.true' }, { is_default: false });
}

/** GET — ที่อยู่ทั้งหมดของผู้ใช้ (เรียงเพิ่มล่าสุดก่อน) */
export async function GET() {
  const user = await currentUser();
  if (!user) return jsonError('กรุณาเข้าสู่ระบบ', 401);

  const rows = await sbList<AddressRow>('addresses', {
    user_id: `eq.${user.id}`,
    select: 'id,label,address_line,location,is_default,created_at',
    order: 'created_at.desc',
  });
  return Response.json({ data: rows });
}

/** POST — เพิ่มที่อยู่ใหม่ (ถ้าตั้งเป็นค่าเริ่มต้น จะเคลียร์อันเดิมก่อน) */
export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user) return jsonError('กรุณาเข้าสู่ระบบ', 401);

  const body = (await req.json().catch(() => ({}))) as AddressInput;
  const v = validate(body);
  if (typeof v === 'string') return jsonError(v, 400);

  if (body.isDefault) await clearDefault(user.id);

  const [row] = await sbInsert<AddressRow>('addresses', {
    user_id: user.id,
    label: v.label,
    address_line: v.addressLine,
    location: null, // แผนที่ยังไม่เชื่อม — ว่างไว้ก่อน
    is_default: Boolean(body.isDefault),
    created_at: new Date().toISOString(),
  });
  return Response.json({ data: row });
}
