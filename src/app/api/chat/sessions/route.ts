import { sbInsert, sbList, sbOne } from '@/lib/supabase';
import { currentUser, jsonError } from '@/lib/api-user';

interface ChatSessionRow {
  id: string;
  user_id: string;
  type: string;
  order_id: string | null;
  is_active: boolean;
  created_at: string;
  closed_at: string | null;
}

interface ChatMessageRow {
  id: string;
  session_id: string;
  sender_type: string;
  sender_id: string | null;
  content: string;
  created_at: string;
}

/** GET — บทสนทนาฝ่ายสนับสนุนที่ยังเปิดอยู่ของผู้ใช้ (ล่าสุดก่อน) พร้อมข้อความล่าสุดของแต่ละบทสนทนา
 *  หมายเหตุ: enum ChatSessionType จริงในฐานข้อมูลคือ ai_support / driver_customer / restaurant_driver / customer_restaurant
 *  ฝ่ายบริการลูกค้า = "ai_support" */
export async function GET() {
  const user = await currentUser();
  if (!user) return jsonError('กรุณาเข้าสู่ระบบ', 401);

  const sessions = await sbList<ChatSessionRow>('chat_sessions', {
    user_id: `eq.${user.id}`,
    type: 'eq.ai_support',
    is_active: 'eq.true',
    order: 'created_at.desc',
  });

  // ดึงข้อความล่าสุดของทุก session ใน query เดียว (เรียงใหม่ → ก่อนพบของใครคือล่าสุดของคนนั้น)
  const lastBySession: Record<string, ChatMessageRow> = {};
  if (sessions.length > 0) {
    const idList = sessions.map((s) => `"${s.id}"`).join(',');
    const messages = await sbList<ChatMessageRow>('chat_messages', {
      session_id: `in.(${idList})`,
      select: 'id,session_id,content,created_at',
      order: 'created_at.desc',
    });
    for (const m of messages) {
      if (!lastBySession[m.session_id]) lastBySession[m.session_id] = m;
    }
  }

  return Response.json({
    data: sessions.map((s) => ({
      ...s,
      last_message: lastBySession[s.id]?.content ?? null,
      last_message_at: lastBySession[s.id]?.created_at ?? null,
    })),
  });
}

/** POST — เปิดบทสนทนาใหม่: ถ้ามี session ที่ยัง active อยู่แล้วให้ใช้อันเดิม ไม่เช่นนั้นสร้างใหม่พร้อมข้อความต้อนรับ */
export async function POST() {
  const user = await currentUser();
  if (!user) return jsonError('กรุณาเข้าสู่ระบบ', 401);

  const existing = await sbOne<ChatSessionRow>('chat_sessions', {
    user_id: `eq.${user.id}`,
    type: 'eq.ai_support',
    is_active: 'eq.true',
    order: 'created_at.desc',
    limit: '1',
  });
  if (existing) return Response.json({ data: existing });

  const now = new Date().toISOString();
  const [session] = await sbInsert<ChatSessionRow>('chat_sessions', {
    user_id: user.id,
    type: 'ai_support',
    order_id: null,
    is_active: true,
    created_at: now,
  });
  await sbInsert('chat_messages', {
    session_id: session.id,
    sender_type: 'system',
    sender_id: null,
    content: 'สวัสดีค่ะ ทีมงานฟู๊ด ธันเดอร์พร้อมช่วยเหลือคุณ พิมพ์ข้อความได้เลย',
    created_at: now,
  });

  return Response.json({ data: session }, { status: 201 });
}
