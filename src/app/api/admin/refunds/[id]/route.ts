import crypto from 'crypto';
import { NextRequest } from 'next/server';
import { requireRole, pushStatusHistory } from '@/lib/portal';
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
    target_type: 'payment_refund_request',
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

interface RefundRow {
  id: string;
  order_id: string;
  amount: number;
  method: string;
  status: string;
  reason: string;
  orders: { order_code: string; customer_id: string; status: string } | null;
}

/** PATCH /api/admin/refunds/[id] — อนุมัติ/ปฏิเสธคำขอคืนเงิน (D1)
 *  body: { action: 'approve' | 'reject', note? }
 *  อนุมัติ: เงินคืนเข้ากระเป๋าเสมอ (credit) + payments/ออเดอร์ สถานะ refunded + แจ้งเตือน + audit */
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

    const refund = await sbOne<RefundRow>('payment_refund_requests', {
      id: `eq.${id}`,
      select: 'id,order_id,amount,method,status,reason,orders(order_code,customer_id,status)',
    });
    if (!refund) return jsonError('ไม่พบคำขอคืนเงินนี้', 404);
    if (refund.status !== 'manual_review') return jsonError('คำขอนี้ดำเนินการไปแล้ว', 409);

    const order = refund.orders;
    if (!order) return jsonError('ข้อมูลออเดอร์ไม่ครบถ้วน', 404);
    // กันคืนเงินซ้ำ: ออเดอร์ต้องยังอยู่ในสถานะที่คืนได้ (ไม่ใช่ refunded/cancelled/จบแล้ว)
    if (action === 'approve' && !['paid', 'restaurant_pending', 'restaurant_accepted', 'preparing', 'ready_for_pickup', 'driver_assigned'].includes(order.status)) {
      return jsonError(`ออเดอร์สถานะ "${order.status}" คืนเงินซ้ำไม่ได้`, 409);
    }

    const amountText = `฿${(refund.amount / 100).toLocaleString('th-TH', { maximumFractionDigits: 2 })}`;
    const nowIso = new Date().toISOString();

    if (action === 'approve') {
      // 1) เงินคืนเข้ากระเป๋า (credit — สตางค์)
      await sbInsert('wallet_transactions', {
        id: crypto.randomUUID(),
        user_id: order.customer_id,
        amount_delta: refund.amount,
        type: 'credit',
        status: 'completed',
        reason: `คืนเงินคำสั่งซื้อ ${order.order_code}`,
        ref_id: refund.order_id,
        created_at: nowIso,
      });
      // 2) payments + ออเดอร์ -> refunded
      await sbUpdate('payments', { order_id: `eq.${refund.order_id}` }, { status: 'refunded' });
      await sbUpdate(
        'orders',
        { id: `eq.${refund.order_id}`, status: 'in.(paid,restaurant_pending,restaurant_accepted,preparing,ready_for_pickup,driver_assigned)' },
        { status: 'refunded', cancelled_reason: `คืนเงิน: ${refund.reason.slice(0, 180)}`, updated_at: nowIso },
      );
      await pushStatusHistory(refund.order_id, 'refunded', `admin:${admin.email}`, `อนุมัติคืนเงิน ${amountText}`);
    }

    // สถานะตาม CHECK constraint ของแม่แบบ: completed = อนุมัติ-คืนเงินแล้ว · failed = ปฏิเสธ
    const nextStatus = action === 'approve' ? 'completed' : 'failed';
    const [updated] = await sbUpdate<{ id: string; status: string }>(
      'payment_refund_requests',
      { id: `eq.${id}`, status: 'eq.manual_review' },
      {
        status: nextStatus,
        reviewed_by: admin.id,
        reviewed_at: nowIso,
        review_note: note?.trim() || null,
        ...(action === 'approve' ? { completed_at: nowIso } : {}),
      },
    );
    if (!updated) return jsonError('คำขอนี้ดำเนินการไปแล้ว', 409);

    // แจ้งเตือนลูกค้าในแอป
    await sbInsert('notifications', {
      id: crypto.randomUUID(),
      user_id: order.customer_id,
      title: action === 'approve' ? 'คืนเงินสำเร็จ' : 'คำขอคืนเงินถูกปฏิเสธ',
      body:
        action === 'approve'
          ? `เงินคืน ${amountText} จากคำสั่งซื้อ ${order.order_code} เข้ากระเป๋าเงินของคุณแล้ว`
          : `คำขอคืนเงินคำสั่งซื้อ ${order.order_code} ไม่ได้รับอนุมัติ${note?.trim() ? ` — ${note.trim()}` : ''}`,
      type: 'refund',
      is_read: false,
    });

    await logAudit(
      admin.id,
      action === 'approve' ? 'refund.approve' : 'refund.reject',
      refund.id,
      req,
      { status: nextStatus, amount: refund.amount, order: order.order_code, note: note?.trim() || null },
    );

    return Response.json({ data: { id: updated.id, status: updated.status } });
  } catch (err) {
    console.error('admin refunds PATCH error:', err);
    return jsonError('ดำเนินการไม่สำเร็จ กรุณาลองใหม่', 500);
  }
}
