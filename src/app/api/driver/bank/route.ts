import { NextRequest } from 'next/server';
import { requireRole } from '@/lib/portal';
import { sbDelete, sbInsert, sbList, sbUpdate } from '@/lib/supabase';
import { jsonError } from '@/lib/api-user';

export interface BankAccountRow {
  id: string;
  bank_code: string;
  bank_name: string;
  account_number: string;
  account_holder_name: string;
  is_default: boolean;
  created_at: string;
}

/** GET /api/driver/bank — บัญชีธนาคารของฉัน (ค่าเริ่มต้นอยู่บนสุด) */
export async function GET(_req: NextRequest) {
  const user = await requireRole('driver');
  if (!user) return jsonError('เฉพาะไรเดอร์เท่านั้น', 403);

  const rows = await sbList<BankAccountRow>('driver_bank_accounts', {
    driver_id: `eq.${user.id}`,
    select: 'id,bank_code,bank_name,account_number,account_holder_name,is_default,created_at',
    order: 'is_default.desc.nullslast,created_at.desc.nullslast',
    limit: '20',
  });
  return Response.json({ data: rows });
}

/** POST /api/driver/bank — เพิ่มบัญชีใหม่ { bankCode, bankName, accountNumber, holderName } */
export async function POST(req: NextRequest) {
  const user = await requireRole('driver');
  if (!user) return jsonError('เฉพาะไรเดอร์เท่านั้น', 403);

  const { bankCode, bankName, accountNumber, holderName } = (await req.json().catch(() => ({}))) as {
    bankCode?: string;
    bankName?: string;
    accountNumber?: string;
    holderName?: string;
  };

  const code = (bankCode ?? '').trim();
  const name = (bankName ?? '').trim();
  const number = (accountNumber ?? '').replace(/[\s-]/g, '');
  const holder = (holderName ?? '').trim();

  if (!code || !name) return jsonError('กรุณาเลือกธนาคาร', 400);
  if (!/^\d{8,16}$/.test(number)) return jsonError('เลขบัญชีต้องเป็นตัวเลข 8–16 หลัก', 400);
  if (holder.length < 3) return jsonError('กรุณาระบุชื่อเจ้าของบัญชี', 400);

  const existing = await sbList<{ id: string }>('driver_bank_accounts', {
    driver_id: `eq.${user.id}`,
    select: 'id',
    limit: '20',
  });
  if (existing.length >= 5) return jsonError('เพิ่มได้สูงสุด 5 บัญชี', 400);

  const now = new Date().toISOString();
  const [row] = await sbInsert<BankAccountRow>('driver_bank_accounts', {
    driver_id: user.id,
    bank_code: code,
    bank_name: name,
    account_number: number,
    account_holder_name: holder,
    is_default: existing.length === 0, // บัญชีแรก = ค่าเริ่มต้นอัตโนมัติ
    created_at: now,
    updated_at: now,
  });
  return Response.json({ data: row }, { status: 201 });
}

/** PATCH /api/driver/bank — ตั้งบัญชีค่าเริ่มต้น { id } */
export async function PATCH(req: NextRequest) {
  const user = await requireRole('driver');
  if (!user) return jsonError('เฉพาะไรเดอร์เท่านั้น', 403);

  const { id } = (await req.json().catch(() => ({}))) as { id?: string };
  if (!id) return jsonError('กรุณาระบุ id บัญชี', 400);

  // ยกเลิกค่าเริ่มต้นเดิมทั้งหมด แล้วตั้งใหม่ (ทำทีละคำสั่งเพื่อความชัวร์กับ PostgREST)
  await sbUpdate('driver_bank_accounts', { driver_id: `eq.${user.id}`, is_default: 'eq.true' }, { is_default: false });
  const [updated] = await sbUpdate<{ id: string; is_default: boolean }>(
    'driver_bank_accounts',
    { id: `eq.${id}`, driver_id: `eq.${user.id}` },
    { is_default: true, updated_at: new Date().toISOString() },
  );
  if (!updated) return jsonError('ไม่พบบัญชีนี้ของคุณ', 404);
  return Response.json({ data: updated });
}

/** DELETE /api/driver/bank?id= — ลบบัญชีของตัวเองเท่านั้น */
export async function DELETE(req: NextRequest) {
  const user = await requireRole('driver');
  if (!user) return jsonError('เฉพาะไรเดอร์เท่านั้น', 403);

  const id = req.nextUrl.searchParams.get('id');
  if (!id) return jsonError('กรุณาระบุ id บัญชี', 400);

  const accounts = await sbList<{ id: string; is_default: boolean }>('driver_bank_accounts', {
    id: `eq.${id}`,
    driver_id: `eq.${user.id}`,
    select: 'id,is_default',
    limit: '1',
  });
  if (accounts.length === 0) return jsonError('ไม่พบบัญชีนี้ของคุณ', 404);

  await sbDelete('driver_bank_accounts', { id: `eq.${id}`, driver_id: `eq.${user.id}` });

  // ถ้าลบบัญชีค่าเริ่มต้นไป → ตั้งให้รายการแรกที่เหลือเป็นค่าเริ่มต้นแทน
  if (accounts[0].is_default) {
    const rest = await sbList<{ id: string }>('driver_bank_accounts', {
      driver_id: `eq.${user.id}`,
      select: 'id',
      order: 'created_at.desc.nullslast',
      limit: '1',
    });
    if (rest[0]) {
      await sbUpdate('driver_bank_accounts', { id: `eq.${rest[0].id}` }, { is_default: true });
    }
  }
  return Response.json({ ok: true });
}
