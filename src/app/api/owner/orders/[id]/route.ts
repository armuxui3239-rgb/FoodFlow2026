import { NextRequest } from 'next/server';
import { requireRole, getOwnerRestaurant, pushStatusHistory, OWNER_TRANSITIONS } from '@/lib/portal';
import { dispatchOrderToDrivers } from '@/lib/dispatch';
import { sbOne, sbUpdate, sbList } from '@/lib/supabase';
import { jsonError } from '@/lib/api-user';

/**
 * PATCH /api/owner/orders/[id] — เจ้าของร้านเปลี่ยนสถานะออเดอร์ตามลำดับเท่านั้น
 * action: accept (รับออเดอร์) | prepare (เริ่มทำอาหาร) | ready (พร้อมส่ง)
 */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await requireRole('restaurant');
  if (!user) return jsonError('เฉพาะเจ้าของร้านเท่านั้น', 403);
  const owner = await getOwnerRestaurant(user.id);
  if (!owner) return jsonError('บัญชีนี้ยังไม่ผูกกับร้านอาหาร', 404);

  const { id } = await ctx.params;
  const { action } = (await req.json().catch(() => ({}))) as { action?: string };
  if (!action) return jsonError('กรุณาระบุ action', 400);

  // ออเดอร์ต้องเป็นของร้านฉันเท่านั้น
  const order = await sbOne<{ id: string; status: string; order_code: string }>('orders', {
    id: `eq.${id}`,
    restaurant_id: `eq.${owner.restaurantId}`,
    select: 'id,status,order_code',
  });
  if (!order) return jsonError('ไม่พบคำสั่งซื้อของร้านคุณ', 404);

  const next = OWNER_TRANSITIONS[order.status]?.[action];
  if (!next) {
    return jsonError(`ทำรายการนี้ไม่ได้ — ออเดอร์อยู่สถานะ ${order.status}`, 400);
  }

  const [updated] = await sbUpdate<{ id: string; status: string }>(
    'orders',
    { id: `eq.${id}`, status: `eq.${order.status}` }, // กัน race: อัปเดตได้เมื่อสถานะยังเดิม
    { status: next, updated_at: new Date().toISOString() },
  );
  if (!updated) return jsonError('สถานะถูกเปลี่ยนไปก่อนแล้ว กรุณารีเฟรช', 409);

  await pushStatusHistory(id, next, user.id, `ร้าน ${owner.restaurantName} ดำเนินการ`);

  // D3: พร้อมส่ง → เสนองานอัตโนมัติให้ไรเดอร์ออนไลน์ (dispatch_offers) — พังไม่รบกวนการเปลี่ยนสถานะ
  let dispatched = 0;
  if (next === 'ready_for_pickup') {
    try {
      dispatched = await dispatchOrderToDrivers(id);
    } catch (e) {
      console.error('dispatch error:', e);
    }
  }

  return Response.json({ ok: true, status: updated.status, dispatched });
}

/** GET รายละเอียดออเดอร์เดียว (ของร้านฉัน) */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await requireRole('restaurant');
  if (!user) return jsonError('เฉพาะเจ้าของร้านเท่านั้น', 403);
  const owner = await getOwnerRestaurant(user.id);
  if (!owner) return jsonError('บัญชีนี้ยังไม่ผูกกับร้านอาหาร', 404);

  const { id } = await ctx.params;
  const order = await sbOne<Record<string, unknown>>('orders', {
    id: `eq.${id}`,
    restaurant_id: `eq.${owner.restaurantId}`,
    select: '*',
  });
  if (!order) return jsonError('ไม่พบคำสั่งซื้อของร้านคุณ', 404);
  const items = await sbList('order_items', {
    order_id: `eq.${id}`,
    select: 'name_snapshot,quantity,unit_price,notes',
    limit: '100',
  });
  const history = await sbList('order_status_history', {
    order_id: `eq.${id}`,
    select: 'status,note,created_at',
    order: 'created_at.asc',
    limit: '50',
  });
  return Response.json({ order, items, history });
}
