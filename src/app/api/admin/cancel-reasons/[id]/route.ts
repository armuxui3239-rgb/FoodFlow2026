import { NextRequest } from 'next/server';
import { requireRole } from '@/lib/portal';
import { sbOne, sbUpdate, sbDelete } from '@/lib/supabase';
import { jsonError } from '@/lib/api-user';

/** PATCH /api/admin/cancel-reasons/[id] — แก้ข้อความ/เปิด-ปิด body: { label?, isActive? } */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const admin = await requireRole('admin');
  if (!admin) return jsonError('เฉพาะผู้ดูแลระบบเท่านั้น', 403);
  const { id } = await ctx.params;
  const { label, isActive } = (await req.json().catch(() => ({}))) as {
    label?: string;
    isActive?: boolean;
  };

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (label !== undefined) {
    const clean = label.trim();
    if (clean.length < 2 || clean.length > 200) {
      return jsonError('ข้อความเหตุผลต้องยาว 2–200 ตัวอักษร', 400);
    }
    patch.label = clean;
  }
  if (isActive !== undefined) patch.is_active = Boolean(isActive);

  const [row] = await sbUpdate<{ id: string; label: string; is_active: boolean }>(
    'cancellation_reasons',
    { id: `eq.${id}` },
    patch,
  );
  if (!row) return jsonError('ไม่พบเหตุผลนี้', 404);
  return Response.json({ data: row });
}

/** DELETE /api/admin/cancel-reasons/[id] — ลบเหตุผลถาวร */
export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const admin = await requireRole('admin');
  if (!admin) return jsonError('เฉพาะผู้ดูแลระบบเท่านั้น', 403);
  const { id } = await ctx.params;
  await sbDelete('cancellation_reasons', { id: `eq.${id}` });
  return Response.json({ data: { ok: true } });
}
