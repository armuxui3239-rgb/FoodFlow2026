import { NextRequest } from 'next/server';
import { sbInsert, sbList, sbOne } from '@/lib/supabase';
import { currentUser, jsonError } from '@/lib/api-user';
import {
  broadcastNewMessage,
  chatChannelName,
  isOrderChatParticipant,
  loadChatOrder,
  sessionTypeForPair,
  type ChatMessageRow,
  type ChatOrderRow,
  type ChatSessionRow,
} from '@/lib/chat-channel';
import type { SessionUser } from '@/lib/session';

/**
 * แชทรายออเดอร์ — ลูกค้า ↔ ไรเดอร์ และ ลูกค้า ↔ ร้าน (คู่สนทนาอ้างอิงจากออเดอร์)
 * - enum จริงของ chat_sessions.type: ai_support/driver_customer/restaurant_driver/customer_restaurant
 *   ลูกค้า+ไรเดอร์ → "driver_customer" | ลูกค้า+ร้าน → "restaurant_driver"
 * - enum จริงของ chat_messages.sender_type: customer/driver/ai/system/restaurant/admin (ตรงกับ role ผู้ใช้)
 * - ข้อความเก็บผ่าน PostgREST เสมอ / broadcast ส่งแค่สัญญาณ {type:'new-message', sessionId} ไม่มีเนื้อหาข้อความ
 */

async function listMessages(sessionId: string): Promise<ChatMessageRow[]> {
  return sbList<ChatMessageRow>('chat_messages', {
    session_id: `eq.${sessionId}`,
    select: 'id,session_id,sender_type,sender_id,content,created_at',
    order: 'created_at.asc',
  });
}

/** หา session ของคู่สนทนานี้ในออเดอร์ — ถ้ายังไม่มีค่อยสร้างใหม่ (user_id = เจ้าของออเดอร์เสมอ) */
async function findOrCreateSession(order: ChatOrderRow, user: SessionUser): Promise<ChatSessionRow> {
  const type = sessionTypeForPair(order, user);
  const existing = await sbOne<ChatSessionRow>('chat_sessions', {
    order_id: `eq.${order.id}`,
    type: `eq.${type}`,
    user_id: `eq.${order.customer_id}`,
    is_active: 'eq.true',
    order: 'created_at.desc',
    limit: '1',
  });
  if (existing) return existing;

  // chat_sessions ไม่มีค่า default (NOT NULL ทั้ง created_at/is_active) — ใส่ค่าเองตามที่ sbInsert ไม่เติมให้
  const [created] = await sbInsert<ChatSessionRow>('chat_sessions', {
    user_id: order.customer_id,
    type,
    order_id: order.id,
    is_active: true,
    created_at: new Date().toISOString(),
  });
  return created;
}

/** ตรวจสิทธิ์: โหลดออเดอร์แล้วเช็คว่าผู้เรียกเป็นผู้ร่วมแชท (แอดมิน/ลูกค้าเจ้าของออเดอร์/ไรเดอร์ผู้รับงาน/เจ้าของร้าน) */
async function verifiedOrder(id: string, user: SessionUser) {
  const order = await loadChatOrder(id);
  if (!order) return { order: null, denied: false } as const;
  const ok = await isOrderChatParticipant(order, user);
  return { order: ok ? order : null, denied: !ok } as const;
}

/** GET — หา/สร้าง session ของคู่สนทนา แล้วคืนข้อความเก่า→ใหม่ พร้อมชื่อช่อง broadcast */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return jsonError('กรุณาเข้าสู่ระบบ', 401);

  const { id } = await ctx.params;
  const { order, denied } = await verifiedOrder(id, user);
  if (!order) return jsonError(denied ? 'คุณไม่ใช่ผู้ร่วมสนทนาของออเดอร์นี้' : 'ไม่พบคำสั่งซื้อ', denied ? 403 : 404);

  const session = await findOrCreateSession(order, user);
  const messages = await listMessages(session.id);
  return Response.json({
    session: {
      id: session.id,
      type: session.type,
      order_id: session.order_id,
      is_active: session.is_active,
    },
    messages,
    channel: chatChannelName(session.id),
  });
}

/** POST — ส่งข้อความ 1–1000 ตัวอักษร เก็บลง PostgREST แล้วเตะ broadcast ให้อีกฝั่งดึงข้อความใหม่ */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return jsonError('กรุณาเข้าสู่ระบบ', 401);

  const { id } = await ctx.params;
  const { order, denied } = await verifiedOrder(id, user);
  if (!order) return jsonError(denied ? 'คุณไม่ใช่ผู้ร่วมสนทนาของออเดอร์นี้' : 'ไม่พบคำสั่งซื้อ', denied ? 403 : 404);

  const { content } = (await req.json().catch(() => ({}))) as { content?: string };
  const text = typeof content === 'string' ? content.trim() : '';
  if (text.length < 1 || text.length > 1000) {
    return jsonError('กรุณาพิมพ์ข้อความ 1-1000 ตัวอักษร', 400);
  }

  const session = await findOrCreateSession(order, user);
  const [message] = await sbInsert<ChatMessageRow>('chat_messages', {
    session_id: session.id,
    sender_id: user.id,
    sender_type: user.role, // customer/driver/restaurant/admin — ตรงกับ enum ChatSenderType
    content: text,
    created_at: new Date().toISOString(), // chat_messages ไม่มีค่า default — ใส่ created_at เองเสมอ
  });
  // หมายเหตุ: chat_sessions ไม่มีคอลัมน์ updated_at (มีแค่ created_at/closed_at/is_active) — จึงไม่ต้องอัปเดต session

  // สัญญาณ broadcast ไม่มีเนื้อหาข้อความ — อีกฝั่งจะดึงใหม่จาก GET นี้เอง (ล้มเหลว = client มี polling สำรอง)
  await broadcastNewMessage(chatChannelName(session.id), session.id);

  return Response.json({ ok: true, message }, { status: 201 });
}
