import { NextRequest } from 'next/server';
import { requireRole } from '@/lib/portal';
import { sbList, sbInsert, sbOne, sbUpdate } from '@/lib/supabase';
import { jsonError } from '@/lib/api-user';

/** GET /api/admin/support-tickets/[id]/replies — ข้อความทั้งหมดของตั๋ว (เก่าสุดก่อน) */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const admin = await requireRole('admin');
  if (!admin) return jsonError('เฉพาะผู้ดูแลระบบเท่านั้น', 403);
  const { id } = await ctx.params;

  const messages = await sbList<{ id: string; ticket_id: string; sender_id: string | null; type: string; body: string; attachments: unknown; created_at: string }>(
    'support_ticket_messages',
    {
      ticket_id: `eq.${id}`,
      select: 'id,ticket_id,sender_id,type,body,attachments,created_at',
      order: 'created_at.asc',
      limit: '200',
    },
  );

  const senderIds = [...new Set(messages.map((m) => m.sender_id).filter((x): x is string => Boolean(x)))];
  const users = senderIds.length
    ? await sbList<{ id: string; full_name: string; role: string }>('users', {
        id: `in.(${senderIds.join(',')})`,
        select: 'id,full_name,role',
        limit: '100',
      })
    : [];

  return Response.json({
    data: messages.map((m) => ({
      ...m,
      senderName: m.sender_id ? users.find((u) => u.id === m.sender_id)?.full_name ?? '-' : 'ระบบ',
      senderRole: m.sender_id ? users.find((u) => u.id === m.sender_id)?.role ?? '-' : 'system',
    })),
  });
}

/**
 * POST /api/admin/support-tickets/[id]/replies — ตอบกลับตั๋ว { body }
 * บันทึก support_ticket_messages (type 'message') + ตั้ง first_responded_at ถ้ายังไม่เคยตอบ
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const admin = await requireRole('admin');
  if (!admin) return jsonError('เฉพาะผู้ดูแลระบบเท่านั้น', 403);
  const { id } = await ctx.params;
  const { body } = (await req.json().catch(() => ({}))) as { body?: string };
  if (!body?.trim()) return jsonError('กรุณาพิมพ์ข้อความตอบกลับ', 400);

  const ticket = await sbOne<{ id: string; first_responded_at: string | null }>('ai_support_tickets', {
    id: `eq.${id}`,
    select: 'id,first_responded_at',
  });
  if (!ticket) return jsonError('ไม่พบตั๋วนี้', 404);

  const [message] = await sbInsert<{ id: string; body: string; created_at: string }>('support_ticket_messages', {
    ticket_id: id,
    sender_id: admin.id,
    type: 'public_reply',
    body: body.trim(),
    created_at: new Date().toISOString(),
  });

  await sbUpdate('ai_support_tickets', { id: `eq.${id}` }, {
    updated_at: new Date().toISOString(),
    ...(ticket.first_responded_at ? {} : { first_responded_at: new Date().toISOString() }),
  });

  return Response.json({ ok: true, message }, { status: 201 });
}
