import { NextRequest } from 'next/server';
import { requireRole, getOwnerRestaurant } from '@/lib/portal';
import { sbOne, sbUpdate } from '@/lib/supabase';
import { jsonError } from '@/lib/api-user';

/** PATCH /api/owner/shifts/[id] — ปิดเวร (completed) หรือยกเลิก (cancelled) body: { status } */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await requireRole('restaurant');
  if (!user) return jsonError('เฉพาะเจ้าของร้านเท่านั้น', 403);
  const owner = await getOwnerRestaurant(user.id);
  if (!owner) return jsonError('บัญชีนี้ยังไม่ผูกกับร้านอาหาร', 404);

  const { id } = await ctx.params;
  const { status } = (await req.json().catch(() => ({}))) as { status?: string };
  if (status !== 'completed' && status !== 'cancelled') {
    return jsonError('สถานะไม่ถูกต้อง (completed/cancelled)', 400);
  }

  // เวรต้องเป็นของร้านฉัน + ยัง scheduled อยู่
  const shift = await sbOne<{ id: string; status: string }>('staff_shifts', {
    id: `eq.${id}`,
    restaurant_id: `eq.${owner.restaurantId}`,
    select: 'id,status',
  });
  if (!shift) return jsonError('ไม่พบเวรนี้', 404);
  if (shift.status !== 'scheduled') return jsonError('เวรนี้ดำเนินการไปแล้ว', 409);

  const [updated] = await sbUpdate<{ id: string; status: string }>(
    'staff_shifts',
    { id: `eq.${id}`, status: 'eq.scheduled' },
    { status, updated_at: new Date().toISOString() },
  );
  if (!updated) return jsonError('สถานะถูกเปลี่ยนไปก่อนแล้ว', 409);

  return Response.json({ data: updated });
}

/** DELETE /api/owner/shifts/[id] — ลบเวรที่ยัง scheduled ได้เฉพาะร้านฉัน */
export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await requireRole('restaurant');
  if (!user) return jsonError('เฉพาะเจ้าของร้านเท่านั้น', 403);
  const owner = await getOwnerRestaurant(user.id);
  if (!owner) return jsonError('บัญชีนี้ยังไม่ผูกกับร้านอาหาร', 404);

  const { id } = await ctx.params;
  await sbUpdate('staff_shifts', { id: `eq.${id}`, restaurant_id: `eq.${owner.restaurantId}` }, {
    status: 'cancelled',
    updated_at: new Date().toISOString(),
  });
  return Response.json({ data: { ok: true } });
}
