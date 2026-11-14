import { sbOne } from '@/lib/supabase';
import { currentUser, jsonError } from '@/lib/api-user';
import {
  chatChannelName,
  isOrderChatParticipant,
  loadChatOrder,
  type ChatSessionRow,
} from '@/lib/chat-channel';

/**
 * GET /api/chat/sessions/[id]/channel
 * คืนชื่อช่อง broadcast ที่คาดเดาไม่ได้ (chat:{id}:{hmac8}) เฉพาะผู้ร่วมสนทนาที่ยืนยันแล้วเท่านั้น
 * HMAC-SHA256(sessionId, SESSION_SECRET) ถูกคำนวณฝั่งเซิร์ฟเวอร์เท่านั้น — คีย์ลับไม่หลุดออกจากเซิร์ฟเวอร์
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return jsonError('กรุณาเข้าสู่ระบบ', 401);

  const { id } = await ctx.params;
  const session = await sbOne<ChatSessionRow>('chat_sessions', {
    id: `eq.${id}`,
    select: 'id,user_id,type,order_id,is_active',
  });
  if (!session) return jsonError('ไม่พบบทสนทนา', 404);

  // ผู้ร่วมสนทนา: เจ้าของ session / แอดมิน / (session รายออเดอร์) ลูกค้า-ไรเดอร์ผู้รับงาน-เจ้าของร้านของออเดอร์นั้น
  let allowed = session.user_id === user.id || user.role === 'admin';
  if (!allowed && session.order_id) {
    const order = await loadChatOrder(session.order_id);
    allowed = !!order && (await isOrderChatParticipant(order, user));
  }
  if (!allowed) return jsonError('ไม่มีสิทธิ์เข้าถึงบทสนทนานี้', 403);

  return Response.json({
    channel: chatChannelName(session.id),
    session: {
      id: session.id,
      type: session.type,
      order_id: session.order_id,
      is_active: session.is_active,
    },
  });
}
