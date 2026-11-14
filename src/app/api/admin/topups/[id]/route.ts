import crypto from 'crypto';
import { NextRequest } from 'next/server';
import { requireRole } from '@/lib/portal';
import { sbOne, sbUpdate, sbInsert, sbHeaders } from '@/lib/supabase';
import { jsonError } from '@/lib/api-user';

/** บันทึก admin_audit_logs (id BIGSERIAL — ใช้ fetch ตรงเพื่อไม่ให้ sbInsert เติม uuid) */
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
    target_type: 'wallet_transaction',
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

function bahtText(satang: number): string {
  return `฿${(satang / 100).toLocaleString('th-TH', { maximumFractionDigits: 2 })}`;
}

/** PATCH /api/admin/topups/[id] — อนุมัติ/ปฏิเสธรายการเติมเงิน (เฟส 5.1)
 *  body: { action: 'approve' | 'reject', note?: string }
 *  อนุมัติ: status completed + แจ้งเตือนในแอป + audit
 *  ปฏิเสธ: status rejected + แจ้งเตือนในแอป + audit */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireRole('admin');
    if (!admin) return jsonError('เฉพาะผู้ดูแลระบบเท่านั้น', 403);

    const { id } = await ctx.params;
    const { action, note } = (await req.json().catch(() => ({}))) as {
      action?: string;
      note?: string;
    };
    if (action !== 'approve' && action !== 'reject') {
      return jsonError('การกระทำไม่ถูกต้อง (approve/reject)', 400);
    }

    const tx = await sbOne<{
      id: string;
      user_id: string;
      amount_delta: number;
      status: string;
    }>('wallet_transactions', {
      id: `eq.${id}`,
      type: 'eq.credit',
      select: 'id,user_id,amount_delta,status',
    });
    if (!tx) return jsonError('ไม่พบรายการเติมเงินนี้', 404);
    if (tx.status !== 'pending') return jsonError('รายการนี้ดำเนินการไปแล้ว', 409);

    const nextStatus = action === 'approve' ? 'completed' : 'rejected';
    const [updated] = await sbUpdate<{ id: string; status: string }>(
      'wallet_transactions',
      { id: `eq.${id}`, status: 'eq.pending' },
      {
        status: nextStatus,
        reviewed_by: admin.id,
        reviewed_at: new Date().toISOString(),
        review_note: note?.trim() || null,
      },
    );
    if (!updated) return jsonError('รายการนี้ดำเนินการไปแล้ว', 409);

    // แจ้งเตือนในแอป (ตาราง notifications — id เป็น uuid ไม่มีค่าเริ่มต้น จึงสร้างเอง)
    const amountText = bahtText(tx.amount_delta);
    await sbInsert('notifications', {
      id: crypto.randomUUID(),
      user_id: tx.user_id,
      title: action === 'approve' ? 'เติมเงินสำเร็จ' : 'เติมเงินถูกปฏิเสธ',
      body:
        action === 'approve'
          ? `ยอดเติมเงิน ${amountText} เข้ากระเป๋าเงินเรียบร้อยแล้ว`
          : `ยอดเติมเงิน ${amountText} ไม่ได้รับอนุมัติ${note?.trim() ? ` — ${note.trim()}` : ''}`,
      type: 'topup',
      is_read: false,
    });

    await logAudit(
      admin.id,
      action === 'approve' ? 'topup.approve' : 'topup.reject',
      tx.id,
      req,
      { status: nextStatus, note: note?.trim() || null },
    );

    return Response.json({ data: { id: updated.id, status: updated.status } });
  } catch (err) {
    console.error('admin topups PATCH error:', err);
    return jsonError('ดำเนินการไม่สำเร็จ กรุณาลองใหม่', 500);
  }
}
