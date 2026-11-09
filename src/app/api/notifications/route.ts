import { NextRequest } from 'next/server';
import { sbList, sbUpdate } from '@/lib/supabase';
import { currentUser, jsonError } from '@/lib/api-user';

interface NotificationRow {
  id: string;
  user_id: string;
  title: string;
  body: string | null;
  type: string;
  data: unknown;
  is_read: boolean;
  created_at: string;
}

/** GET — รายการแจ้งเตือนของผู้ใช้ (ล่าสุดก่อน สูงสุด 50 รายการ) */
export async function GET() {
  const user = await currentUser();
  if (!user) return jsonError('กรุณาเข้าสู่ระบบ', 401);

  const notifications = await sbList<NotificationRow>('notifications', {
    user_id: `eq.${user.id}`,
    select: 'id,title,body,type,data,is_read,created_at',
    order: 'created_at.desc',
    limit: '50',
  });
  return Response.json({ data: notifications });
}

/** PATCH — ทำเครื่องหมายว่าอ่านแล้ว: { id } รายการเดียว หรือ { all: true } ทั้งหมด (ตรวจ user_id เสมอ) */
export async function PATCH(req: NextRequest) {
  const user = await currentUser();
  if (!user) return jsonError('กรุณาเข้าสู่ระบบ', 401);

  const { id, all } = (await req.json().catch(() => ({}))) as { id?: string; all?: boolean };

  if (all === true) {
    await sbUpdate<NotificationRow>(
      'notifications',
      { user_id: `eq.${user.id}`, is_read: 'eq.false' },
      { is_read: true },
    );
    return Response.json({ data: { ok: true } });
  }

  if (typeof id !== 'string' || !id.trim()) {
    return jsonError('กรุณาระบุรายการแจ้งเตือนที่ต้องการอ่าน', 400);
  }

  const [row] = await sbUpdate<NotificationRow>(
    'notifications',
    { id: `eq.${id}`, user_id: `eq.${user.id}` },
    { is_read: true },
  );
  if (!row) return jsonError('ไม่พบรายการแจ้งเตือน', 404);
  return Response.json({ data: { ok: true } });
}
