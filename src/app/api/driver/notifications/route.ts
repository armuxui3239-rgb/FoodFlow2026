import { NextRequest } from 'next/server';
import { requireRole } from '@/lib/portal';
import { sbList, sbUpdate } from '@/lib/supabase';
import { jsonError } from '@/lib/api-user';

interface NotificationRow {
  id: string;
  title: string;
  body: string | null;
  type: string | null;
  data: unknown;
  is_read: boolean;
  created_at: string;
}

/** GET /api/driver/notifications — แจ้งเตือนของฉัน (50 รายการล่าสุด) + จำนวนยังไม่อ่าน */
export async function GET(_req: NextRequest) {
  const user = await requireRole('driver');
  if (!user) return jsonError('เฉพาะไรเดอร์เท่านั้น', 403);

  const data = await sbList<NotificationRow>('notifications', {
    user_id: `eq.${user.id}`,
    select: 'id,title,body,type,data,is_read,created_at',
    order: 'created_at.desc',
    limit: '50',
  });
  return Response.json({ data, unread: data.filter((n) => !n.is_read).length });
}

/** PATCH /api/driver/notifications — อ่านทั้งหมด { all: true } */
export async function PATCH(_req: NextRequest) {
  const user = await requireRole('driver');
  if (!user) return jsonError('เฉพาะไรเดอร์เท่านั้น', 403);

  await sbUpdate('notifications', { user_id: `eq.${user.id}`, is_read: 'eq.false' }, { is_read: true });
  return Response.json({ ok: true });
}
