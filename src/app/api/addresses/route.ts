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
  lat?: number;
  lng?: number;
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

/** POST — เพิ่มที่อยู่ใหม่ (ถ้าตั้งเป็นค่าเริ่มต้น จะเคลียร์อันอื่นหลัง insert สำเร็จ) */
export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user) return jsonError('กรุณาเข้าสู่ระบบ', 401);

  const body = (await req.json().catch(() => ({}))) as AddressInput;
  const v = validate(body);
  if (typeof v === 'string') return jsonError(v, 400);

  // คอลัมน์ location เป็น geography NOT NULL (โซ่ delivery_tasks อ่านค่านี้ต่อ) — ใช้พิกัดที่ส่งมา
  // ถ้าไม่มีใช้จุดกลางกรุงเทพฯ เป็นค่าตั้งต้นที่ประมาณ (ระบุสัจจะเหมือน ETA)
  const lat = Number(body.lat);
  const lng = Number(body.lng);
  const hasCoords = Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
  const location = hasCoords
    ? `SRID=4326;POINT(${lng} ${lat})`
    : 'SRID=4326;POINT(100.5018 13.7563)';

  const [row] = await sbInsert<AddressRow>('addresses', {
    user_id: user.id,
    label: v.label,
    address_line: v.addressLine,
    location,
    // insert แบบไม่ default ก่อนเสมอ — DB มี unique index "หนึ่ง default ต่อคน" แล้วตั้งทีหลัง
    is_default: false,
    created_at: new Date().toISOString(),
  });
  if (!row) return jsonError('เพิ่มที่อยู่ไม่สำเร็จ', 500);

  // ตั้งค่าเริ่มต้น "หลัง" insert สำเร็จ: เคลียร์ของเดิม → ตั้งแถวใหม่
  if (body.isDefault) {
    await clearDefault(user.id);
    await sbUpdate('addresses', { id: `eq.${row.id}` }, { is_default: true });
  }
  return Response.json({ data: { ...row, is_default: Boolean(body.isDefault) } });
}
