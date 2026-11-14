import { NextRequest } from 'next/server';
import { requireRole } from '@/lib/portal';
import { sbOne, sbUpdate, sbHeaders } from '@/lib/supabase';
import { jsonError } from '@/lib/api-user';

/** PATCH /api/admin/payouts/[id] — ยืนยันโอนเงินจริง (mark settled) body: { batchId? }
 *  ป้องกัน mark ซ้ำ: status ต้องยัง pending (D5) */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireRole('admin');
    if (!admin) return jsonError('เฉพาะผู้ดูแลระบบเท่านั้น', 403);

    const { id } = await ctx.params;
    const { batchId } = (await req.json().catch(() => ({}))) as { batchId?: string };

    const payout = await sbOne<{ id: string; status: string }>('payout_ledger', {
      id: `eq.${id}`,
      recipient_type: 'eq.driver',
      select: 'id,status',
    });
    if (!payout) return jsonError('ไม่พบรายการจ่ายเงินนี้', 404);
    if (payout.status !== 'pending') return jsonError('รายการนี้ยืนยันโอนไปแล้ว', 409);

    const [updated] = await sbUpdate<{ id: string; status: string }>(
      'payout_ledger',
      { id: `eq.${id}`, status: 'eq.pending' },
      {
        status: 'settled',
        settled_at: new Date().toISOString(),
        // settlement_batch_id เป็นคอลัมน์ uuid — รับเฉพาะ uuid ที่ถูกต้อง ถ้าไม่ใช่ให้สร้างให้เอง
        ...(batchId?.trim() && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(batchId.trim())
          ? { settlement_batch_id: batchId.trim() }
          : { settlement_batch_id: crypto.randomUUID() }),
      },
    );
    if (!updated) return jsonError('รายการนี้ยืนยันไปแล้ว', 409);

    try {
      await fetch(`${process.env.SUPABASE_URL}/rest/v1/admin_audit_logs`, {
        method: 'POST',
        headers: { ...sbHeaders(), Prefer: 'return=minimal' },
        body: JSON.stringify([{
          admin_id: admin.id,
          action: 'driver_payout.settled',
          target_type: 'payout_ledger',
          target_id: payout.id,
          ip_address: (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || '0.0.0.0',
          severity: 'info',
          created_at: new Date().toISOString(),
        }]),
      });
    } catch {
      // audit พังไม่รบกวน
    }

    return Response.json({ data: updated });
  } catch (err) {
    console.error('admin payouts PATCH error:', err);
    return jsonError('ดำเนินการไม่สำเร็จ กรุณาลองใหม่', 500);
  }
}
