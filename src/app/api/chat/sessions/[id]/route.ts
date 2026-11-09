import { NextRequest } from 'next/server';
import { sbInsert, sbList, sbOne } from '@/lib/supabase';
import { currentUser, jsonError } from '@/lib/api-user';

interface ChatSessionRow {
  id: string;
  user_id: string;
  type: string;
  is_active: boolean;
}

interface ChatMessageRow {
  id: string;
  session_id: string;
  sender_type: string;
  sender_id: string | null;
  content: string;
  created_at: string;
}

async function listMessages(sessionId: string): Promise<ChatMessageRow[]> {
  return sbList<ChatMessageRow>('chat_messages', {
    session_id: `eq.${sessionId}`,
    select: 'id,session_id,sender_type,sender_id,content,created_at',
    order: 'created_at.asc',
  });
}

/** GET — ข้อความทั้งหมดของบทสนทนา (เก่า → ใหม่) ตรวจสิทธิ์ว่าเป็น session ของผู้ใช้เอง */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return jsonError('กรุณาเข้าสู่ระบบ', 401);

  const { id } = await ctx.params;
  const session = await sbOne<ChatSessionRow>('chat_sessions', {
    id: `eq.${id}`,
    user_id: `eq.${user.id}`,
    select: 'id,user_id,type,is_active',
  });
  if (!session) return jsonError('ไม่พบบทสนทนา', 404);

  const messages = await listMessages(session.id);
  return Response.json({ data: messages });
}

/** POST — ส่งข้อความของลูกค้า แล้วระบบตอบกลับอัตโนมัติ คืนรายการข้อความทั้งหมดหลังส่ง */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return jsonError('กรุณาเข้าสู่ระบบ', 401);

  const { id } = await ctx.params;
  const session = await sbOne<ChatSessionRow>('chat_sessions', {
    id: `eq.${id}`,
    user_id: `eq.${user.id}`,
    select: 'id,user_id,type,is_active',
  });
  if (!session) return jsonError('ไม่พบบทสนทนา', 404);

  const { content } = (await req.json().catch(() => ({}))) as { content?: string };
  const text = typeof content === 'string' ? content.trim() : '';
  if (text.length < 1 || text.length > 1000) {
    return jsonError('กรุณาพิมพ์ข้อความ 1-1000 ตัวอักษร', 400);
  }

  await sbInsert('chat_messages', {
    session_id: session.id,
    sender_type: 'customer',
    sender_id: user.id,
    content: text,
    created_at: new Date().toISOString(),
  });
  // ข้อความตอบกลับอัตโนมัติ (เจตนาเพื่อให้ทดสอบการสนทนาจริงได้)
  // หมายเหตุ: enum ChatSenderType จริงในฐานข้อมูล = customer/driver/ai/system/restaurant/admin — ผู้ตอบอัตโนมัติใช้ "ai"
  await sbInsert('chat_messages', {
    session_id: session.id,
    sender_type: 'ai',
    sender_id: null,
    content: 'ได้รับข้อความของคุณแล้วค่ะ ทีมงานจะตอบกลับโดยเร็วที่สุด',
    created_at: new Date().toISOString(),
  });

  const messages = await listMessages(session.id);
  return Response.json({ data: messages }, { status: 201 });
}
