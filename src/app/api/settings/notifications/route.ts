import { NextRequest } from 'next/server';
import { sbInsert, sbList, sbUpdate } from '@/lib/supabase';
import { currentUser, jsonError } from '@/lib/api-user';

export interface NotificationSettingRow {
  id: string;
  event_type: string;
  channels: string[] | null;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export const EVENT_TYPES = ['order_updates', 'promotions', 'new_services'] as const;

/** GET — การตั้งค่าการแจ้งเตือนของผู้ใช้ (ถ้ายังไม่มี สร้าง 3 แถวค่าเริ่มให้ก่อน) */
export async function GET() {
  const user = await currentUser();
  if (!user) return jsonError('กรุณาเข้าสู่ระบบ', 401);

  let rows = await sbList<NotificationSettingRow>('notification_settings', {
    user_id: `eq.${user.id}`,
    select: 'id,event_type,channels,enabled,created_at,updated_at',
  });

  if (rows.length === 0) {
    const now = new Date().toISOString();
    rows = await sbInsert<NotificationSettingRow>(
      'notification_settings',
      EVENT_TYPES.map((event_type) => ({
        user_id: user.id,
        event_type,
        channels: ['push'],
        enabled: true,
        created_at: now,
        updated_at: now,
      })),
    );
  }

  return Response.json({ data: rows });
}

/** PATCH — เปิด/ปิดการแจ้งเตือนตามประเภทเหตุการณ์ */
export async function PATCH(req: NextRequest) {
  const user = await currentUser();
  if (!user) return jsonError('กรุณาเข้าสู่ระบบ', 401);

  const { eventType, enabled } = (await req.json().catch(() => ({}))) as {
    eventType?: string;
    enabled?: boolean;
  };
  if (!eventType || !EVENT_TYPES.includes(eventType as (typeof EVENT_TYPES)[number])) {
    return jsonError('ประเภทการแจ้งเตือนไม่ถูกต้อง', 400);
  }
  if (typeof enabled !== 'boolean') return jsonError('สถานะการแจ้งเตือนไม่ถูกต้อง', 400);

  const now = new Date().toISOString();
  const [row] = await sbUpdate<NotificationSettingRow>(
    'notification_settings',
    { user_id: `eq.${user.id}`, event_type: `eq.${eventType}` },
    { enabled, updated_at: now },
  );
  return Response.json({ data: row });
}
