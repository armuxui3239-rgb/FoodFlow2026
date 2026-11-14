import { NextRequest } from 'next/server';
import { requireRole } from '@/lib/portal';
import { sbUpdate } from '@/lib/supabase';
import { jsonError } from '@/lib/api-user';

/** PATCH /api/driver/notifications/[id] — ทำเครื่องหมายว่าอ่านแล้ว (เฉพาะของฉัน) */
export async function PATCH(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await requireRole('driver');
  if (!user) return jsonError('เฉพาะไรเดอร์เท่านั้น', 403);
  const { id } = await ctx.params;

  const [updated] = await sbUpdate<{ id: string; is_read: boolean }>(
    'notifications',
    { id: `eq.${id}`, user_id: `eq.${user.id}` },
    { is_read: true },
  );
  if (!updated) return jsonError('ไม่พบการแจ้งเตือนนี้', 404);
  return Response.json({ ok: true });
}
