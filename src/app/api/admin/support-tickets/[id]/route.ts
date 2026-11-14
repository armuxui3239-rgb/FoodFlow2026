import { NextRequest } from 'next/server';
import { requireRole } from '@/lib/portal';
import { sbList, sbOne, sbUpdate, sbHeaders } from '@/lib/supabase';
import { jsonError } from '@/lib/api-user';

/** บันทึก admin_audit_logs (id BIGSERIAL — ใช้ fetch ตรงเพื่อไม่ให้ sbInsert เติม uuid) */
async function logAudit(
  adminId: string,
  action: string,
  targetType: string,
  targetId: string | null,
  req: NextRequest,
  newValue?: unknown,
): Promise<void> {
  const row: Record<string, unknown> = {
    admin_id: adminId,
    action,
    target_type: targetType,
    ...(targetId ? { target_id: targetId } : {}),
    ...(newValue !== undefined ? { new_value: newValue as never } : {}),
    ip_address: (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || '0.0.0.0',
    severity: 'info',
    created_at: new Date().toISOString(),
  };
  try {
    await fetch(`${process.env.SUPABASE_URL}/rest/v1/admin_audit_logs`, {
      method: 'POST',
      headers: { ...sbHeaders(), Prefer: 'return=minimal' },
      body: JSON.stringify([row]),
    });
  } catch {
    // บันทึกตรวจสอบล้มเหลวต้องไม่ทำให้การทำงานหลักล้ม
  }
}

/** ตรวจว่า error จาก PostgREST เป็นข้อจำกัด enum ของฐานข้อมูลจริงหรือไม่ (ตาราง TicketStatus ยังมีแค่ 'open') */
function isEnumLimitError(message: string): boolean {
  return /invalid input value for enum|violates check constraint|value too long/i.test(message);
}

/** GET /api/admin/support-tickets/[id] — ตั๋ว + ข้อความทั้งหมด + ออเดอร์ที่เกี่ยวข้อง */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const admin = await requireRole('admin');
  if (!admin) return jsonError('เฉพาะผู้ดูแลระบบเท่านั้น', 403);
  const { id } = await ctx.params;

  const ticket = await sbOne<{
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
    id: `eq.${id}`,
    select:
      'id,user_id,order_id,issue_type,summary,priority,status,assigned_admin_id,resolution_notes,created_at,resolved_at,channel,tags',
  });
  if (!ticket) return jsonError('ไม่พบตั๋วนี้', 404);

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
  const allUserIds = [...new Set([ticket.user_id, ...senderIds, ...(ticket.assigned_admin_id ? [ticket.assigned_admin_id] : [])])];
  const users = allUserIds.length
    ? await sbList<{ id: string; full_name: string; email: string; role: string }>('users', {
        id: `in.(${allUserIds.join(',')})`,
        select: 'id,full_name,email,role',
        limit: '100',
      })
    : [];

  const order = ticket.order_id
    ? await sbOne<{ id: string; order_code: string; status: string; total: number; restaurant_id: string; created_at: string }>('orders', {
        id: `eq.${ticket.order_id}`,
        select: 'id,order_code,status,total,restaurant_id,created_at',
      })
    : null;
  const restaurant = order
    ? await sbOne<{ id: string; name: string }>('restaurants', { id: `eq.${order.restaurant_id}`, select: 'id,name', limit: '1' })
    : null;

  return Response.json({
    ticket: {
      ...ticket,
      userName: users.find((u) => u.id === ticket.user_id)?.full_name ?? '-',
      userEmail: users.find((u) => u.id === ticket.user_id)?.email ?? '-',
      assignedAdminName: ticket.assigned_admin_id
        ? users.find((u) => u.id === ticket.assigned_admin_id)?.full_name ?? null
        : null,
    },
    messages: messages.map((m) => ({
      ...m,
      senderName: m.sender_id ? users.find((u) => u.id === m.sender_id)?.full_name ?? '-' : 'ระบบ',
      senderRole: m.sender_id ? users.find((u) => u.id === m.sender_id)?.role ?? '-' : 'system',
    })),
    order: order ? { ...order, restaurantName: restaurant?.name ?? '-' } : null,
  });
}

/**
 * PATCH /api/admin/support-tickets/[id] — เปลี่ยนสถานะ / บันทึกโน้ตการแก้ / รับงานเอง
 * { status?, resolutionNotes?, assignSelf? }
 * หมายเหตุ: enum TicketStatus ในฐานข้อมูลจริงยังมีแค่ 'open' — ค่าอื่นอาจถูกฐานข้อมูลปฏิเสธ
 */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const admin = await requireRole('admin');
  if (!admin) return jsonError('เฉพาะผู้ดูแลระบบเท่านั้น', 403);
  const { id } = await ctx.params;
  const { status, resolutionNotes, assignSelf } = (await req.json().catch(() => ({}))) as {
    status?: string;
    resolutionNotes?: string;
    assignSelf?: boolean;
  };

  const ticket = await sbOne<{ id: string; status: string; assigned_admin_id: string | null }>('ai_support_tickets', {
    id: `eq.${id}`,
    select: 'id,status,assigned_admin_id',
  });
  if (!ticket) return jsonError('ไม่พบตั๋วนี้', 404);

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (status !== undefined) {
    if (!['open', 'in_progress', 'resolved', 'closed'].includes(status)) {
      return jsonError('สถานะต้องเป็น open, in_progress, resolved หรือ closed', 400);
    }
    patch.status = status;
    if (status === 'resolved' || status === 'closed') patch.resolved_at = new Date().toISOString();
  }
  if (resolutionNotes !== undefined) patch.resolution_notes = resolutionNotes.trim() || null;
  if (assignSelf) patch.assigned_admin_id = admin.id;
  if (Object.keys(patch).length === 1) return jsonError('ไม่มีข้อมูลที่จะแก้', 400);

  try {
    const [updated] = await sbUpdate<{ id: string; status: string }>('ai_support_tickets', { id: `eq.${id}` }, patch);
    if (!updated) return jsonError('ไม่พบตั๋วนี้', 404);
    await logAudit(admin.id, 'support_ticket.update', 'support_ticket', id, req, patch);
    return Response.json({ ok: true, ticket: updated });
  } catch (e) {
    const msg = (e as Error).message;
    if (isEnumLimitError(msg)) {
      return jsonError(
        'ฐานข้อมูลจริงยังไม่รองรับสถานะอื่นนอกจาก "open" (ต้องรัน SQL migration เพิ่มค่า enum TicketStatus ก่อน)',
        400,
      );
    }
    return jsonError('บันทึกไม่สำเร็จ: ' + msg, 500);
  }
}
