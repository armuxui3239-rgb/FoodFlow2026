import { NextRequest } from 'next/server';
import { requireRole } from '@/lib/portal';
import { sbOne, sbUpdate, sbHeaders } from '@/lib/supabase';
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
    target_type: 'password_reset_token',
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

/** PATCH /api/admin/pin-resets/[id] — อนุมัติ/ปฏิเสธคำขอรีเซ็ต PIN (v4 ข้อ 4.5)
 *  body: { action: 'approve' | 'reject', note?: string } */
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

    const request = await sbOne<{ id: string; status: string; expires_at: string }>(
      'password_reset_tokens',
      { id: `eq.${id}`, select: 'id,status,expires_at' },
    );
    if (!request) return jsonError('ไม่พบคำขอนี้', 404);
    if (request.status !== 'pending') return jsonError('คำขอนี้ดำเนินการไปแล้ว', 409);
    if (new Date(request.expires_at).getTime() < Date.now()) {
      return jsonError('คำขอหมดอายุ (24 ชั่วโมง) ผู้ใช้ต้องส่งคำขอใหม่', 410);
    }

    const nextStatus = action === 'approve' ? 'approved' : 'rejected';
    const [updated] = await sbUpdate<{ id: string; status: string }>(
      'password_reset_tokens',
      { id: `eq.${id}`, status: 'eq.pending' },
      {
        status: nextStatus,
        reviewed_by: admin.id,
        reviewed_at: new Date().toISOString(),
        review_note: note?.trim() || null,
      },
    );
    if (!updated) return jsonError('คำขอนี้ดำเนินการไปแล้ว', 409);

    await logAudit(
      admin.id,
      action === 'approve' ? 'pin_reset.approve' : 'pin_reset.reject',
      request.id,
      req,
      { status: nextStatus, note: note?.trim() || null },
    );

    return Response.json({ data: { id: updated.id, status: updated.status } });
  } catch (err) {
    console.error('admin pin-resets PATCH error:', err);
    return jsonError('ดำเนินการไม่สำเร็จ กรุณาลองใหม่', 500);
  }
}
