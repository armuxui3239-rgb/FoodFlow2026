import { NextRequest } from 'next/server';
import { requireRole } from '@/lib/portal';
import { sbOne, sbList, sbUpdate, sbDelete } from '@/lib/supabase';
import { jsonError } from '@/lib/api-user';

interface BankAccount {
  id: string;
  driver_id: string;
  bank_code: string;
  bank_name: string;
  account_number: string;
  is_default: boolean;
}

/** PATCH /api/driver/bank/[id] — ตั้งเป็นบัญชีค่าเริ่มต้น */
export async function PATCH(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await requireRole('driver');
  if (!user) return jsonError('เฉพาะไรเดอร์เท่านั้น', 403);
  const { id } = await ctx.params;

  const account = await sbOne<BankAccount>('driver_bank_accounts', {
    id: `eq.${id}`,
    driver_id: `eq.${user.id}`,
    select: 'id,driver_id,bank_code,bank_name,account_number,is_default',
  });
  if (!account) return jsonError('ไม่พบบัญชีธนาคารนี้', 404);

  // ยกเลิกค่าเริ่มต้นของบัญชีอื่นก่อน แล้วจึงตั้งบัญชีนี้
  await sbUpdate('driver_bank_accounts', { driver_id: `eq.${user.id}`, id: `neq.${id}`, is_default: 'eq.true' }, { is_default: false });
  const [updated] = await sbUpdate<BankAccount>(
    'driver_bank_accounts',
    { id: `eq.${id}`, driver_id: `eq.${user.id}` },
    { is_default: true, updated_at: new Date().toISOString() },
  );
  return Response.json({ ok: true, account: updated });
}

/** DELETE /api/driver/bank/[id] — ลบบัญชีธนาคาร */
export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await requireRole('driver');
  if (!user) return jsonError('เฉพาะไรเดอร์เท่านั้น', 403);
  const { id } = await ctx.params;

  const account = await sbOne<BankAccount>('driver_bank_accounts', {
    id: `eq.${id}`,
    driver_id: `eq.${user.id}`,
    select: 'id,is_default',
  });
  if (!account) return jsonError('ไม่พบบัญชีธนาคารนี้', 404);

  await sbDelete('driver_bank_accounts', { id: `eq.${id}`, driver_id: `eq.${user.id}` });

  // ถ้าลบบัญชีค่าเริ่มต้นไป ให้บัญชีล่าสุดที่เหลือเป็นค่าเริ่มต้นแทน
  if (account.is_default) {
    const remaining = await sbList<{ id: string }>('driver_bank_accounts', {
      driver_id: `eq.${user.id}`,
      select: 'id',
      order: 'created_at.desc',
      limit: '1',
    });
    if (remaining[0]) {
      await sbUpdate('driver_bank_accounts', { id: `eq.${remaining[0].id}` }, { is_default: true });
    }
  }
  return Response.json({ ok: true });
}
