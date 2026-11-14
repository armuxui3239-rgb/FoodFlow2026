import crypto from 'crypto';
import { sbInsert, sbList, sbOne } from '@/lib/supabase';
import { currentUser, jsonError } from '@/lib/api-user';

/** สถานะที่ลูกค้าขอคืนเงินได้ — จ่ายแล้วแต่ยังไม่ออกจัดส่ง */
const REFUNDABLE_STATUSES = [
  'paid',
  'restaurant_pending',
  'restaurant_accepted',
  'preparing',
  'ready_for_pickup',
];

interface PaymentRow {
  id: string;
  amount: number;
  method: string;
  status: string;
}

/** GET /api/orders/[id]/refund-request — สถานะคำขอคืนเงินล่าสุดของออเดอร์นี้ (เจ้าของเท่านั้น)
 *  ค่าสถานะตาม CHECK constraint ของแม่แบบ: manual_review (รอตรวจ) · completed (อนุมัติ-คืนแล้ว) · failed (ปฏิเสธ) */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return jsonError('กรุณาเข้าสู่ระบบ', 401);
  const { id } = await ctx.params;
  const order = await sbOne<{ id: string }>('orders', {
    id: `eq.${id}`,
    customer_id: `eq.${user.id}`,
    select: 'id',
  });
  if (!order) return jsonError('ไม่พบคำสั่งซื้อ', 404);
  const req = await sbOne<{ status: string; reason: string }>('payment_refund_requests', {
    order_id: `eq.${id}`,
    order: 'created_at.desc',
    limit: '1',
    select: 'status,reason',
  });
  return Response.json({ data: req ?? null });
}

/** POST /api/orders/[id]/refund-request — ลูกค้าขอคืนเงิน body: { reason }
 *  สร้างคำขอ (pending) ให้แอดมินตรวจ — 1 ออเดอร์มีคำขอค้างได้ 1 เรื่อง (v4 ข้อ 6 / D1) */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await currentUser();
    if (!user) return jsonError('กรุณาเข้าสู่ระบบ', 401);
    if (user.role !== 'customer') return jsonError('เฉพาะบัญชีลูกค้าเท่านั้น', 403);

    const { id } = await ctx.params;
    const { reason } = (await req.json().catch(() => ({}))) as { reason?: string };
    const clean = (reason ?? '').trim();
    if (clean.length < 5) return jsonError('กรุณาอธิบายเหตุผลการขอคืนเงิน (อย่างน้อย 5 ตัวอักษร)', 400);

    const order = await sbOne<{ id: string; order_code: string; status: string }>('orders', {
      id: `eq.${id}`,
      customer_id: `eq.${user.id}`,
      select: 'id,order_code,status',
    });
    if (!order) return jsonError('ไม่พบคำสั่งซื้อ', 404);
    if (!REFUNDABLE_STATUSES.includes(order.status)) {
      return jsonError('ขอคืนเงินได้หลังชำระเงินและก่อนไรเดอร์ออกจัดส่งเท่านั้น', 400);
    }

    // คำขอค้าง/ที่อนุมัติแล้ว = ไม่รับซ้ำ (สถานะตาม CHECK constraint ของแม่แบบ)
    const dupe = await sbList<{ id: string }>('payment_refund_requests', {
      order_id: `eq.${id}`,
      status: 'in.(manual_review,completed)',
      select: 'id',
      limit: '1',
    });
    if (dupe.length) return jsonError('ออเดอร์นี้มีคำขอคืนเงินอยู่แล้ว', 409);

    const payment = await sbOne<PaymentRow>('payments', {
      order_id: `eq.${id}`,
      status: 'in.(completed,pending)',
      order: 'created_at.desc',
      limit: '1',
      select: 'id,amount,method,status',
    });
    if (!payment) return jsonError('ไม่พบรายการชำระเงินของออเดอร์นี้', 404);

    const nowIso = new Date().toISOString();
    await sbInsert('payment_refund_requests', {
      id: crypto.randomUUID(),
      refund_key: crypto.randomUUID(),
      order_id: order.id,
      payment_id: payment.id,
      amount: payment.amount,
      kind: 'full',
      reason: clean.slice(0, 500),
      method: payment.method,
      // สถานะตาม CHECK constraint ของตาราง: manual_review = รอแอดมินตรวจ (โมเดลแม่แบบ)
      status: 'manual_review',
      attempts: 0,
      requested_by: user.id,
      created_at: nowIso,
      updated_at: nowIso,
    });

    return Response.json({ data: { ok: true, status: 'manual_review' } }, { status: 201 });
  } catch (err) {
    console.error('refund-request error:', err);
    return jsonError('ส่งคำขอคืนเงินไม่สำเร็จ กรุณาลองใหม่', 500);
  }
}
