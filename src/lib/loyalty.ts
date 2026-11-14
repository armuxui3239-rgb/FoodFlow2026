import 'server-only';
import { sbList, sbInsert } from '@/lib/supabase';

/**
 * ระบบสะสมแต้ม (loyalty) — ROADMAP P1: "สะสมแต้มจริงตอนสั่งซื้อ"
 * กฎ 1 แต้มต่อออเดอร์ที่จบสมบูรณ์ ('completed') — เขียนเมื่อจบจริงเท่านั้น
 * (ยกเลิก/คืนเงินไม่ได้แต้ม) · โมเดลเดียวกับข้อมูล seed ที่มีอยู่จริง
 * (points=1, type=credit, ผูก order_id, description ตาม seed) · กันเขียนซ้ำต่อออเดอร์
 * · พังไม่รบกวนการเปลี่ยนสถานะออเดอร์ (try/catch คืน 0)
 */
export async function earnLoyaltyPoints(order: { id: string; customer_id: string }): Promise<number> {
  try {
    const existing = await sbList<{ id: string }>('loyalty_transactions', {
      order_id: `eq.${order.id}`,
      type: 'eq.credit',
      select: 'id',
      limit: '1',
    });
    if (existing.length > 0) return 0; // ออเดอร์นี้ได้แต้มไปแล้ว — ไม่เขียนซ้ำ
    await sbInsert('loyalty_transactions', {
      user_id: order.customer_id,
      points: 1,
      type: 'credit',
      description: 'สะสมคะแนนจากคำสั่งซื้อ',
      order_id: order.id,
    });
    return 1;
  } catch (e) {
    console.error('loyalty earn error:', e);
    return 0;
  }
}
