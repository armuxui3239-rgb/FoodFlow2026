import { NextRequest } from 'next/server';
import { sbDelete, sbOne, sbUpdate } from '@/lib/supabase';
import { currentUser, jsonError } from '@/lib/api-user';
import type { AddressRow } from '../route';

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

/** PATCH — แก้ไขที่อยู่ (ตรวจเจ้าของก่อน รวมถึงตรรกะค่าเริ่มต้นเหมือน POST) */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return jsonError('กรุณาเข้าสู่ระบบ', 401);
  const { id } = await ctx.params;

  const addr = await sbOne<{ id: string; user_id: string }>('addresses', {
    id: `eq.${id}`,
    select: 'id,user_id',
  });
  if (!addr || addr.user_id !== user.id) return jsonError('ไม่พบที่อยู่นี้', 404);

  const body = (await req.json().catch(() => ({}))) as AddressInput;
  const v = validate(body);
  if (typeof v === 'string') return jsonError(v, 400);

  // ตั้งเป็นค่าเริ่มต้น → เคลียร์อื่น ๆ ของผู้ใช้ก่อน
  if (body.isDefault) {
    await sbUpdate('addresses', { user_id: `eq.${user.id}`, is_default: 'eq.true' }, { is_default: false });
  }

  const lat = Number(body.lat);
  const lng = Number(body.lng);
  const hasCoords =
    body.lat !== undefined &&
    body.lng !== undefined &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180;

  const [row] = await sbUpdate<AddressRow>(
    'addresses',
    { id: `eq.${addr.id}` },
    {
      label: v.label,
      address_line: v.addressLine,
      ...(hasCoords ? { location: `SRID=4326;POINT(${lng} ${lat})` } : {}),
      ...(body.isDefault !== undefined ? { is_default: Boolean(body.isDefault) } : {}),
    },
  );
  return Response.json({ data: row });
}

/** DELETE — ลบที่อยู่ (ตรวจเจ้าของก่อน และกันลบที่อยู่ที่มีประวัติคำสั่งซื้อ) */
export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return jsonError('กรุณาเข้าสู่ระบบ', 401);
  const { id } = await ctx.params;

  const addr = await sbOne<{ id: string; user_id: string }>('addresses', {
    id: `eq.${id}`,
    select: 'id,user_id',
  });
  if (!addr || addr.user_id !== user.id) return jsonError('ไม่พบที่อยู่นี้', 404);

  const usedInOrder = await sbOne<{ id: string }>('orders', {
    delivery_address_id: `eq.${addr.id}`,
    select: 'id',
    limit: '1',
  });
  if (usedInOrder) {
    return jsonError('ไม่สามารถลบที่อยู่นี้ได้ เนื่องจากมีประวัติคำสั่งซื้อที่ใช้ที่อยู่นี้อยู่', 409);
  }

  await sbDelete('addresses', { id: `eq.${addr.id}` });
  return Response.json({ data: { id: addr.id } });
}
