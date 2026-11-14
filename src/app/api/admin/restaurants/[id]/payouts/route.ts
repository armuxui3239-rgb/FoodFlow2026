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
    target_type: 'restaurant_payout',
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

/** หา user_id เจ้าของร้าน (restaurant_profiles staff_role = owner) */
async function getRestaurantOwnerId(restaurantId: string): Promise<string | null> {
  const profile = await sbOne<{ user_id: string }>('restaurant_profiles', {
    restaurant_id: `eq.${restaurantId}`,
    staff_role: 'eq.owner',
    select: 'user_id',
    limit: '1',
  });
  return profile?.user_id ?? null;
}

/** GET /api/admin/restaurants/[id]/payouts — ประวัติการจ่ายเงินร้านนี้
 *  [id] = restaurant id (หาเจ้าของจาก restaurant_profiles) */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const admin = await requireRole('admin');
  if (!admin) return jsonError('เฉพาะผู้ดูแลระบบเท่านั้น', 403);
  const { id } = await ctx.params;

  const ownerId = await getRestaurantOwnerId(id);
  if (!ownerId) return jsonError('ไม่พบเจ้าของร้านนี้', 404);

  const rows = await sbList<PayoutRow>('payout_ledger', {
    recipient_type: 'eq.restaurant',
    recipient_id: `eq.${ownerId}`,
    order: 'created_at.desc',
    limit: '50',
    select: 'id,amount,status,settlement_batch_id,created_at,settled_at,dedupe_key',
  });
  return Response.json({ data: rows });
}

/** POST /api/admin/restaurants/[id]/payouts — บันทึกการจ่ายเงินรายได้ให้ร้าน body: { amountSatang, batchId? }
 *  status = pending (รอโอนจริง) — ยืนยันโอนแล้ว mark settled ผ่าน /api/admin/payouts/[id] */
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

  const ownerId = await getRestaurantOwnerId(id);
  if (!ownerId) return jsonError('ไม่พบเจ้าของร้านนี้', 404);

  const dedupeKey = crypto.createHash('sha256').update(`restaurant:${id}:${amount}:${Date.now()}:${crypto.randomUUID()}`).digest('hex').slice(0, 64);
  const nowIso = new Date().toISOString();
  const [row] = await sbInsert<{ id: string; amount: number; status: string }>('payout_ledger', {
    id: crypto.randomUUID(),
    order_id: null,
    recipient_type: 'restaurant',
    recipient_id: ownerId,
    amount,
    currency: 'THB',
    status: 'pending',
    settlement_batch_id: batchId?.trim() || null,
    dedupe_key: dedupeKey,
    created_at: nowIso,
  });

  await logAudit(admin.id, 'restaurant_payout.create', id, req, { amount, status: 'pending', batchId: batchId?.trim() || null });

  return Response.json({ data: row }, { status: 201 });
}
