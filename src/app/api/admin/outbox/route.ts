import { NextRequest } from 'next/server';
import { requireRole } from '@/lib/portal';
import { drainOutbox } from '@/lib/outbox';
import { sbList } from '@/lib/supabase';
import { jsonError } from '@/lib/api-user';

interface OutboxRow {
  id: string;
  channel: string;
  event: string;
  payload: Record<string, unknown>;
  created_at: string;
  delivered_at: string | null;
  error: string | null;
}

/** GET /api/admin/outbox — เหตุการณ์ค้างในท่อ (ยังไม่ delivered) (D7) */
export async function GET(_req: NextRequest) {
  const admin = await requireRole('admin');
  if (!admin) return jsonError('เฉพาะผู้ดูแลระบบเท่านั้น', 403);
  const rows = await sbList<OutboxRow>('realtime_outbox', {
    order: 'created_at.desc',
    limit: '100',
    select: 'id,channel,event,payload,created_at,delivered_at,error',
  });
  const undelivered = rows.filter((r) => !r.delivered_at);
  return Response.json({ data: { pending: undelivered, recent: rows } });
}

/** POST /api/admin/outbox — drain: ส่งเหตุการณ์ค้างออกทาง Supabase Realtime broadcast แล้ว mark delivered (D7) */
export async function POST(_req: NextRequest) {
  const admin = await requireRole('admin');
  if (!admin) return jsonError('เฉพาะผู้ดูแลระบบเท่านั้น', 403);
  const result = await drainOutbox(100);
  return Response.json({ data: result });
}
