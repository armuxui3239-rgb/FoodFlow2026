import { NextRequest } from 'next/server';
import { requireRole } from '@/lib/portal';
import { sbInsert, sbList, sbOne } from '@/lib/supabase';
import { jsonError } from '@/lib/api-user';

interface TaskRow {
  id: string;
  order_id: string;
  status: string;
}

interface OrderRow {
  id: string;
  status: string;
}

/**
 * POST /api/driver/trips/[id]/tip-report — ไรเดอร์รายงานทิปที่ได้รับ { amountSatang }
 * - id = delivery_tasks.id ของฉันเท่านั้น
 * - ออเดอร์ต้องส่งถึงลูกค้าแล้ว (delivered/completed)
 * - ทิปได้ครั้งเดียวต่อออเดอร์ (UNIQUE order_id → 409 ถ้ารายงานไปแล้ว)
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireRole('driver');
  if (!user) return jsonError('เฉพาะไรเดอร์เท่านั้น', 403);
  const { id } = await params;

  const body = (await req.json().catch(() => ({}))) as { amountSatang?: number };
  const amount = Number(body.amountSatang);
  if (!Number.isInteger(amount) || amount < 1000 || amount > 100000) {
    return jsonError('จำนวนทิปต้องอยู่ระหว่าง 10–1,000 บาท', 400);
  }

  const task = await sbOne<TaskRow>('delivery_tasks', {
    id: `eq.${id}`,
    driver_id: `eq.${user.id}`,
    select: 'id,order_id,status',
  });
  if (!task) return jsonError('ไม่พบงานนี้ของคุณ', 404);

  const order = await sbOne<OrderRow>('orders', {
    id: `eq.${task.order_id}`,
    select: 'id,status',
  });
  if (!order) return jsonError('ไม่พบข้อมูลออเดอร์ของงานนี้', 404);
  if (order.status !== 'delivered' && order.status !== 'completed') {
    return jsonError('รายงานทิปได้หลังส่งอาหารถึงลูกค้าแล้วเท่านั้น', 400);
  }

  // หนึ่งออเดอร์รายงานทิปได้ครั้งเดียว
  const existing = await sbList<{ id: string }>('driver_tip_reports', {
    order_id: `eq.${order.id}`,
    select: 'id',
    limit: '1',
  });
  if (existing.length > 0) return jsonError('รายงานทิปนี้แล้ว', 409);

  const now = new Date().toISOString();
  try {
    await sbInsert('driver_tip_reports', {
      order_id: order.id,
      driver_id: user.id, // ตรงกับ GET /api/driver/tips ที่กรอง driver_id = user.id (FK อ้าง users.id)
      amount,
      status: 'reported',
      created_at: now,
      updated_at: now,
    });
  } catch (e) {
    // กัน race กับ UNIQUE(order_id, driver_id) ของฐานข้อมูลจริง
    const msg = String((e as Error).message ?? '');
    if (msg.includes('23505') || msg.toLowerCase().includes('duplicate')) {
      return jsonError('รายงานทิปนี้แล้ว', 409);
    }
    throw e;
  }

  return Response.json({ ok: true, amount });
}
