import 'server-only';
import crypto from 'crypto';
import { sbOne } from '@/lib/supabase';
import type { SessionUser } from '@/lib/session';
import { getOwnerRestaurant } from '@/lib/portal';

/**
 * ตัวช่วยฝั่งเซิร์ฟเวอร์สำหรับแชทรายออเดอร์ — ใช้ร่วมกันระหว่าง
 * /api/chat/sessions/[id]/channel และ /api/orders/[id]/chat
 *
 * นโยบาย: ทุกอย่างอยู่ในระบบของเราบน Supabase เท่านั้น (Realtime Broadcast)
 * ชื่อช่องต้องคาดเดาไม่ได้ และคืนเฉพาะผู้ร่วมสนทนาที่ยืนยันแล้วผ่าน API ของเราเท่านั้น
 */

/** hmac16 = 16 ตัวอักษรแรก (hex) ของ HMAC-SHA256(id, SESSION_SECRET) — คำนวณฝั่งเซิร์ฟเวอร์เท่านั้น */
export function hmac16(id: string): string {
  const secret = process.env.SESSION_SECRET || 'food-thunder-dev-secret';
  return crypto.createHmac('sha256', secret).update(id).digest('hex').slice(0, 16);
}

/** ชื่อช่อง broadcast ที่คาดเดาไม่ได้: chat:{sessionId}:{hmac16} */
export function chatChannelName(sessionId: string): string {
  return `chat:${sessionId}:${hmac16(sessionId)}`;
}

/** ชื่อช่องห้องโทร (จบในระบบ): calls:{orderId}:{hmac16} — คืนเฉพาะผู้ร่วมออเดอร์ผ่าน API เท่านั้น */
export function callRoomName(orderId: string): string {
  return `calls:${orderId}:${hmac16(orderId)}`;
}

/** ชื่อช่องกริ่งส่วนบุคคล: ring:{userId}:{hmac16} — ไว้รับ {type:'incoming-call'} */
export function callRingChannelName(userId: string): string {
  return `ring:${userId}:${hmac16(userId)}`;
}

export interface ChatSessionRow {
  id: string;
  user_id: string;
  type: string;
  order_id: string | null;
  is_active: boolean;
}

export interface ChatOrderRow {
  id: string;
  customer_id: string;
  driver_id: string | null;
  restaurant_id: string;
  status: string;
}

export interface ChatMessageRow {
  id: string;
  session_id: string;
  sender_type: string;
  sender_id: string | null;
  content: string;
  created_at: string;
}

/** โหลดออเดอร์เฉพาะคอลัมน์ที่ใช้ตรวจสิทธิ์ผู้ร่วมแชท */
export async function loadChatOrder(orderId: string): Promise<ChatOrderRow | null> {
  return sbOne<ChatOrderRow>('orders', {
    id: `eq.${orderId}`,
    select: 'id,customer_id,driver_id,restaurant_id,status',
  });
}

/** ผู้ร่วมแชทของออเดอร์: แอดมิน / ลูกค้าเจ้าของออเดอร์ / ไรเดอร์ที่ได้รับงาน / เจ้าของร้านของออเดอร์ */
export async function isOrderChatParticipant(order: ChatOrderRow, user: SessionUser): Promise<boolean> {
  if (user.role === 'admin') return true;
  if (order.customer_id === user.id) return true;
  if (order.driver_id && order.driver_id === user.id) return true;
  if (user.role === 'restaurant') {
    const owner = await getOwnerRestaurant(user.id);
    return !!owner && owner.restaurantId === order.restaurant_id;
  }
  return false;
}

/**
 * ประเภท chat_sessions ตามคู่สนทนา (enum จริงในฐานข้อมูล: ai_support/driver_customer/restaurant_driver/customer_restaurant)
 * - ลูกค้า + ไรเดอร์ผู้รับงาน → "driver_customer"
 * - ลูกค้า + ร้าน → "restaurant_driver"
 * ไรเดอร์/ร้านเป็นผู้เปิดแชท → ประเภทตามคู่ของตน ส่วนลูกค้า/แอดมินดูจากว่ามีไรเดอร์ผู้รับงานหรือยัง
 */
export function sessionTypeForPair(order: ChatOrderRow, user: SessionUser): 'driver_customer' | 'restaurant_driver' {
  if (user.role === 'driver' || (order.driver_id && order.driver_id === user.id)) return 'driver_customer';
  if (user.role === 'restaurant') return 'restaurant_driver';
  return order.driver_id ? 'driver_customer' : 'restaurant_driver';
}

/**
 * ส่ง broadcast ไปยังช่อง Supabase Realtime ผ่าน REST API (ภายในระบบ Supabase ของเราเท่านั้น — service key)
 * ใช้ร่วมกันทั้งแชท ({type:'new-message'}) และระบบโทร ({type:'incoming-call'} บนช่องกริ่ง)
 * best-effort: ถ้าล้มเหลวให้เงียบไว้ client ยังมีสำรองของตัวเองเสมอ
 */
export async function broadcastEvent(
  channelName: string,
  event: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const base = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!base || !key) return;
  try {
    const res = await fetch(`${base}/realtime/v1/api/broadcast`, {
      method: 'POST',
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [
          { topic: channelName, event, payload, private: false },
        ],
      }),
    });
    if (!res.body) return;
    await res.body.cancel().catch(() => undefined); // ไม่สนใจเนื้อคืน — ปิด stream ให้เรียบร้อย
  } catch {
    // เงียบไว้ — ฝั่ง client มีกลไกสำรองของตัวเอง
  }
}

/**
 * สัญญาณแชท: payload ไม่มีเนื้อหาข้อความ — มีแค่ {type:'new-message', sessionId}
 * เพื่อเตะให้อีกฝั่งดึงข้อความใหม่จาก API (client มี polling สำรองทุก 8 วินาที)
 */
export async function broadcastNewMessage(channelName: string, sessionId: string): Promise<void> {
  await broadcastEvent(channelName, 'message', { type: 'new-message', sessionId });
}
