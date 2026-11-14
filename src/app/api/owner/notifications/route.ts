import { NextRequest } from 'next/server';
import { requireRole } from '@/lib/portal';
import { sbList, sbUpdate } from '@/lib/supabase';
import { jsonError } from '@/lib/api-user';

interface NotiRow {
  id: string;
  title: string;
  body: string | null;
  type: string;
  data: Record<string, unknown> | null;
  is_read: boolean;
  created_at: string;
}

/** GET /api/owner/notifications — แจ้งเตือนของบัญชีนี้ 50 รายการล่าสุด + จำนวนที่ยังไม่อ่าน */
export async function GET(_req: NextRequest) {
  const user = await requireRole('restaurant');
  if (!user) return jsonError('เฉพาะเจ้าของร้านเท่านั้น', 403);

  const data = await sbList<NotiRow>('notifications', {
    user_id: `eq.${user.id}`,
    select: 'id,title,body,type,data,is_read,created_at',
    order: 'created_at.desc',
    limit: '50',
  });

  return Response.json({ data, unreadCount: data.filter((n) => !n.is_read).length });
}

/** PATCH /api/owner/notifications — body { all: true } → ทำเครื่องหมายว่าอ่านทั้งหมด */
export async function PATCH(req: NextRequest) {
  const user = await requireRole('restaurant');
  if (!user) return jsonError('เฉพาะเจ้าของร้านเท่านั้น', 403);

  const body = (await req.json().catch(() => ({}))) as { all?: boolean };
  if (body.all !== true) return jsonError('ต้องระบุ all: true เท่านั้น', 400);

  await sbUpdate('notifications', { user_id: `eq.${user.id}`, is_read: 'eq.false' }, { is_read: true });
  return Response.json({ ok: true });
}
