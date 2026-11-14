import crypto from 'crypto';
import { NextRequest } from 'next/server';
import { requireRole } from '@/lib/portal';
import { sbList, sbOne, sbInsert, sbHeaders } from '@/lib/supabase';
import { jsonError } from '@/lib/api-user';

interface PayoutRow {
  id: string;
  amount: number;
  status: string;
  settlement_batch_id: string | null;
  created_at: string;
  settled_at: string | null;
  dedupe_key: string;
}

/** บันทึก admin_audit_logs (id BIGSERIAL — ใช้ fetch ตรง) */
async function logAudit(
  adminId: string,
  action: string,
  targetId: string,
  req: NextRequest,
  newValue: unknown,
): Promise<void> {
  const row: Record<string, unknown> = {
    admin_id: adminId,
    action,
    target_type: 'driver_payout',
    target_id: targetId,
    new_value: newValue as never,
    ip_address: (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || '0.0.0.0',
    severity: 'info',
    created_at: new Date().toISOString(),
  };
  try {
    await fetch(`${process.env.SUPABASE_URL}/rest/v1/admin_audit_logs`, {
      method: 'POST',
      headers: { ...sbHeaders(), Prefer: 'return=minimal' },
      body: JSON.stringify([row]),
    });
  } catch {
    // บันทึกตรวจสอบล้มเหลวต้องไม่ทำให้การทำงานหลักล้ม
  }
}

/** GET /api/admin/drivers/[id]/payouts — ประวัติการจ่ายเงินไรเดอร์คนนี้ (D5)
 *  [id] = user_id ของไรเดอร์ */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const admin = await requireRole('admin');
  if (!admin) return jsonError('เฉพาะผู้ดูแลระบบเท่านั้น', 403);
  const { id } = await ctx.params;

  const rows = await sbList<PayoutRow>('payout_ledger', {
    recipient_type: 'eq.driver',
    recipient_id: `eq.${id}`,
    order: 'created_at.desc',
    limit: '50',
    select: 'id,amount,status,settlement_batch_id,created_at,settled_at,dedupe_key',
  });
  return Response.json({ data: rows });
}

/** POST /api/admin/drivers/[id]/payouts — บันทึกการจ่ายเงินให้ไรเดอร์ body: { amountSatang, batchId? }
 *  status = pending (รอโอนจริง) — แอดมินยืนยันโอนแล้ว mark settled ภายหลัง (D5) */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const admin = await requireRole('admin');
  if (!admin) return jsonError('เฉพาะผู้ดูแลระบบเท่านั้น', 403);
  const { id } = await ctx.params;

  const { amountSatang, batchId } = (await req.json().catch(() => ({}))) as {
    amountSatang?: number;
    batchId?: string;
  };
  const amount = Number(amountSatang);
  if (!Number.isInteger(amount) || amount < 1000) {
    return jsonError('ยอดจ่ายต้องเป็นจำนวนเต็มอย่างน้อย 10 บาท (1,000 สตางค์)', 400);
  }

  // ไรเดอร์ต้องมีตัวตนจริง
  const user = await sbOne<{ id: string; full_name: string | null }>('users', {
    id: `eq.${id}`,
    role: 'eq.driver',
    select: 'id,full_name',
  });
  if (!user) return jsonError('ไม่พบบัญชีไรเดอร์นี้', 404);

  const dedupeKey = crypto.createHash('sha256').update(`driver:${id}:${amount}:${Date.now()}:${crypto.randomUUID()}`).digest('hex').slice(0, 64);
  const nowIso = new Date().toISOString();
  const [row] = await sbInsert<{ id: string; amount: number; status: string }>('payout_ledger', {
    id: crypto.randomUUID(),
    order_id: null,
    recipient_type: 'driver',
    recipient_id: id,
    amount,
    currency: 'THB',
    status: 'pending',
    settlement_batch_id: batchId?.trim() || null,
    dedupe_key: dedupeKey,
    created_at: nowIso,
  });

  await logAudit(admin.id, 'driver_payout.create', user.id, req, { amount, status: 'pending', batchId: batchId?.trim() || null });

  return Response.json({ data: row }, { status: 201 });
}
