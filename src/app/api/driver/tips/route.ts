import { NextRequest } from 'next/server';
import { requireRole } from '@/lib/portal';
import { sbList, sbOne, sbInsert } from '@/lib/supabase';
import { jsonError } from '@/lib/api-user';

interface TipRow {
  id: string;
  order_id: string;
  amount: number;
  status: string;
  created_at: string;
}

interface TipOrderRow {
  id: string;
  customer_id: string;
  status: string;
  driver_id: string | null;
}

/** GET /api/driver/tips — ทิปจากลูกค้า (driver_tip_reports) + รวมทั้งหมด */
export async function GET(_req: NextRequest) {
  const user = await requireRole('driver');
  if (!user) return jsonError('เฉพาะไรเดอร์เท่านั้น', 403);

  const rows = await sbList<TipRow>('driver_tip_reports', {
    driver_id: `eq.${user.id}`,
    select: 'id,order_id,amount,status,created_at',
    order: 'created_at.desc.nullslast',
    limit: '50',
  });

  const orderIds = [...new Set(rows.map((r) => r.order_id))];
  const orders = orderIds.length
    ? await sbList<{ id: string; order_code: string }>('orders', {
        id: `in.(${orderIds.join(',')})`,
        select: 'id,order_code',
        limit: '100',
      })
    : [];
  const codeByOrder = new Map(orders.map((o) => [o.id, o.order_code]));

  const totalSatang = rows.reduce((s, r) => s + Number(r.amount), 0);

  return Response.json({
    totalSatang,
    data: rows.map((r) => ({
      id: r.id,
      orderCode: codeByOrder.get(r.order_id) ?? '-',
      amountSatang: Number(r.amount),
      status: r.status,
      createdAt: r.created_at,
    })),
  });
}

/**
 * POST /api/driver/tips — ลูกค้าทิปไรเดอร์ { orderId, amountSatang }
 * - ต้องเป็นออเดอร์ของตัวเอง สถานะ delivered/completed และมีไรเดอร์ผู้รับงาน
 * - ทิปได้ครั้งเดียวต่อออเดอร์ (409 ถ้ามีแล้ว)
 */
export async function POST(req: NextRequest) {
  const user = await requireRole('customer');
  if (!user) return jsonError('เฉพาะลูกค้าเท่านั้น', 403);

  const body = (await req.json().catch(() => ({}))) as { orderId?: string; amountSatang?: number };
  if (!body.orderId) return jsonError('กรุณาระบุ orderId', 400);

  const amount = Number(body.amountSatang);
  if (!Number.isInteger(amount) || amount < 1000 || amount > 100000) {
    return jsonError('จำนวนทิปต้องอยู่ระหว่าง 10–1,000 บาท', 400);
  }

  const order = await sbOne<TipOrderRow>('orders', {
    id: `eq.${body.orderId}`,
    select: 'id,customer_id,status,driver_id',
  });
  if (!order) return jsonError('ไม่พบคำสั่งซื้อ', 404);
  if (order.customer_id !== user.id) return jsonError('ไม่มีสิทธิ์ทิปคำสั่งซื้อนี้', 403);
  if (order.status !== 'delivered' && order.status !== 'completed') {
    return jsonError('ทิปไรเดอร์ได้หลังส่งอาหารถึงแล้วเท่านั้น', 400);
  }
  if (!order.driver_id) return jsonError('คำสั่งซื้อนี้ไม่มีไรเดอร์จัดส่ง', 400);

  // หนึ่งออเดอร์ทิปได้ครั้งเดียว
  const existing = await sbList<{ id: string }>('driver_tip_reports', {
    order_id: `eq.${order.id}`,
    select: 'id',
    limit: '1',
  });
  if (existing.length > 0) return jsonError('คุณทิปคำสั่งซื้อนี้ไปแล้ว', 409);

  const now = new Date().toISOString();
  await sbInsert('driver_tip_reports', {
    order_id: order.id,
    driver_id: order.driver_id,
    amount,
    status: 'reported',
    created_at: now,
    updated_at: now,
  });

  return Response.json({ ok: true });
}
