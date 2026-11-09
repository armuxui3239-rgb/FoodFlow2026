import { NextRequest } from 'next/server';
import crypto from 'crypto';
import { cookies } from 'next/headers';
import { sbOne } from '@/lib/supabase';
import { currentUser } from '@/lib/api-user';

/**
 * POST /api/calls/token?order=<id> — ตามแพตช์ v3.1 ข้อ 6
 *
 * LiveKit + coturn ต้องใช้พอร์ต UDP และใบรับรอง TLS ซึ่ง Vercel/Railway ให้ไม่ได้
 * โค้ดนี้พร้อมใช้ทันทีเมื่อมีเซิร์ฟเวอร์จริง: กรอก LIVEKIT_URL + LIVEKIT_API_KEY +
 * LIVEKIT_API_SECRET ใน .env แล้วเปิด NEXT_PUBLIC_CALLS_ENABLED=true
 * จนกว่านั้น endpoint ตอบ 503 "ยังไม่เปิดใช้งาน" อย่างชัดเจน
 * ห้ามรายงานว่าฟีเจอร์ใช้งานได้ก่อนทดสอบจริงบนเซิร์ฟเวอร์ (เกณฑ์ 18 → ย้ายไป "รอเซิร์ฟเวอร์")
 */

interface LiveKitVideoGrant {
  room?: string;
  roomJoin?: boolean;
  canPublish?: boolean;
  canSubscribe?: boolean;
  canPublishData?: boolean;
}

function liveKitJwt(grant: LiveKitVideoGrant, identity: string, ttlSec: number): string {
  const apiKey = process.env.LIVEKIT_API_KEY!;
  const apiSecret = process.env.LIVEKIT_API_SECRET!;
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(
    JSON.stringify({
      iss: apiKey,
      sub: identity,
      jti: crypto.randomUUID(),
      exp: now + ttlSec,
      nbf: now - 5,
      ...grant,
    }),
  ).toString('base64url');
  const sig = crypto
    .createHmac('sha256', apiSecret)
    .update(`${header}.${payload}`)
    .digest('base64url');
  return `${header}.${payload}.${sig}`;
}

export async function POST(req: NextRequest) {
  try {
    const user = await currentUser();
    if (!user?.id) {
      return Response.json({ error: 'กรุณาเข้าสู่ระบบ' }, { status: 401 });
    }
    const orderId = req.nextUrl.searchParams.get('order') ?? '';
    if (!orderId) {
      return Response.json({ error: 'ไม่พบคำสั่งซื้อ' }, { status: 400 });
    }
    // ผู้ใช้ต้องเป็นเจ้าของคำสั่งซื้อจริง
    const order = await sbOne<{ id: string; user_id: string }>('orders', {
      id: `eq.${orderId}`,
      select: 'id,user_id',
    });
    if (!order || order.user_id !== user.id) {
      return Response.json({ error: 'ไม่พบคำสั่งซื้อ' }, { status: 404 });
    }

    const url = process.env.LIVEKIT_URL;
    const key = process.env.LIVEKIT_API_KEY;
    const secret = process.env.LIVEKIT_API_SECRET;
    if (!url || !key || !secret) {
      return Response.json(
        { error: 'ยังไม่เปิดใช้งาน — ระบบยังไม่มีเซิร์ฟเวอร์สื่อ (LiveKit) รองรับ' },
        { status: 503 },
      );
    }

    const roomName = `order-${orderId}`.slice(0, 80);
    const token = liveKitJwt(
      {
        room: roomName,
        roomJoin: true,
        canPublish: true,
        canSubscribe: true,
        canPublishData: true,
      },
      user.id,
      3600,
    );
    return Response.json({ roomName, wsUrl: url, token });
  } catch (err) {
    console.error('calls/token error:', err);
    return Response.json({ error: 'สร้างการโทรไม่สำเร็จ' }, { status: 500 });
  }
}
