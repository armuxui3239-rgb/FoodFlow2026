import { NextRequest } from 'next/server';
import { requireRole } from '@/lib/portal';
import { sbList, sbInsert } from '@/lib/supabase';
import { jsonError } from '@/lib/api-user';

interface Ticket {
  id: string;
  issue_type: string;
  summary: string;
  priority: string;
  status: string;
  resolution_notes: string | null;
  created_at: string;
  resolved_at: string | null;
}

// enum TicketIssueType จริงในฐานข้อมูลรองรับครบ 6 หมวด
const ISSUE_TYPES = ['late_delivery', 'wrong_item', 'missing_item', 'driver_issue', 'refund_request', 'other'];
const PRIORITIES = ['low', 'medium', 'high', 'critical'];
const CHANNELS = ['ai_chat', 'email', 'phone', 'in_app'];

/** GET /api/driver/support — ตั๋วช่วยเหลือของฉัน (ล่าสุดก่อน) */
export async function GET(_req: NextRequest) {
  const user = await requireRole('driver');
  if (!user) return jsonError('เฉพาะไรเดอร์เท่านั้น', 403);

  const data = await sbList<Ticket>('ai_support_tickets', {
    user_id: `eq.${user.id}`,
    select: 'id,issue_type,summary,priority,status,resolution_notes,created_at,resolved_at',
    order: 'created_at.desc',
    limit: '50',
  });
  return Response.json({ data });
}

/** POST /api/driver/support — เปิดตั๋วช่วยเหลือ { issue_type, summary } */
export async function POST(req: NextRequest) {
  const user = await requireRole('driver');
  if (!user) return jsonError('เฉพาะไรเดอร์เท่านั้น', 403);

  const body = (await req.json().catch(() => ({}))) as { issue_type?: string; summary?: string; priority?: string; channel?: string };
  const issueType = body.issue_type?.trim();
  const summary = body.summary?.trim();
  if (!issueType || !ISSUE_TYPES.includes(issueType)) return jsonError('กรุณาเลือกหัวข้อปัญหา', 400);
  if (!summary) return jsonError('กรุณาอธิบายปัญหา', 400);
  if (summary.length > 2000) return jsonError('คำอธิบายยาวเกินไป (สูงสุด 2000 ตัวอักษร)', 400);
  const priority = body.priority && PRIORITIES.includes(body.priority) ? body.priority : 'medium';
  const channel = body.channel && CHANNELS.includes(body.channel) ? body.channel : 'in_app';

  const [created] = await sbInsert<Ticket>('ai_support_tickets', {
    user_id: user.id,
    issue_type: issueType,
    summary,
    priority,
    status: 'open',
    channel,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
  return Response.json({ ok: true, ticket: created }, { status: 201 });
}
