import { NextRequest } from 'next/server';
import { requireRole } from '@/lib/portal';
import { sbUpdate } from '@/lib/supabase';
import { jsonError } from '@/lib/api-user';

/** PATCH /api/owner/notifications/[id] — ทำเครื่องหมายว่าอ่านแล้ว 1 รายการ (guard: เป็นแจ้งเตือนของตัวเองเท่านั้น) */
export async function PATCH(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireRole('restaurant');
  if (!user) return jsonError('เฉพาะเจ้าของร้านเท่านั้น', 403);

  const { id } = await params;
  await sbUpdate('notifications', { id: `eq.${id}`, user_id: `eq.${user.id}` }, { is_read: true });
  return Response.json({ ok: true });
}
