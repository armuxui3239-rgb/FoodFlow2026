import { NextRequest } from 'next/server';
import { requireRole } from '@/lib/portal';
import { sbUpdate } from '@/lib/supabase';
import { jsonError } from '@/lib/api-user';

/** PATCH /api/driver/notifications/[id] — ทำเครื่องหมายอ่าน/ยกเลิก { isRead?: boolean } (เฉพาะของฉัน) */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await requireRole('driver');
  if (!user) return jsonError('เฉพาะไรเดอร์เท่านั้น', 403);
  const { id } = await ctx.params;

  const body = (await req.json().catch(() => ({}))) as { isRead?: boolean };
  const isRead = body.isRead === undefined ? true : Boolean(body.isRead);

  const [updated] = await sbUpdate<{ id: string; is_read: boolean }>(
    'notifications',
    { id: `eq.${id}`, user_id: `eq.${user.id}` },
    { is_read: isRead },
  );
  if (!updated) return jsonError('ไม่พบการแจ้งเตือนนี้', 404);
  return Response.json({ ok: true, is_read: isRead });
}
