import { NextRequest } from 'next/server';
import { requireRole } from '@/lib/portal';
import { sbList } from '@/lib/supabase';
import { jsonError } from '@/lib/api-user';

/** GET /api/admin/support-tickets — ตั๋วซัพพอร์ตล่าสุด 50 รายการ (พร้อมชื่อผู้ใช้) */
export async function GET(_req: NextRequest) {
  const admin = await requireRole('admin');
  if (!admin) return jsonError('เฉพาะผู้ดูแลระบบเท่านั้น', 403);

  const tickets = await sbList<{
    id: string;
    user_id: string;
    order_id: string | null;
    issue_type: string;
    summary: string;
    priority: string;
    status: string;
    assigned_admin_id: string | null;
    resolution_notes: string | null;
    created_at: string;
    resolved_at: string | null;
    channel: string;
    tags: string[] | null;
  }>('ai_support_tickets', {
    select:
      'id,user_id,order_id,issue_type,summary,priority,status,assigned_admin_id,resolution_notes,created_at,resolved_at,channel,tags',
    order: 'created_at.desc',
    limit: '50',
  });

  const userIds = [...new Set(tickets.map((t) => t.user_id))];
  const users = userIds.length
    ? await sbList<{ id: string; full_name: string; email: string }>('users', {
        id: `in.(${userIds.join(',')})`,
        select: 'id,full_name,email',
        limit: '100',
      })
    : [];

  return Response.json({
    data: tickets.map((t) => ({
      ...t,
      userName: users.find((u) => u.id === t.user_id)?.full_name ?? '-',
      userEmail: users.find((u) => u.id === t.user_id)?.email ?? '-',
    })),
  });
}
