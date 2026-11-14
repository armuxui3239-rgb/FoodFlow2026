import type { NextRequest } from 'next/server';
import { currentUser, jsonError } from '@/lib/api-user';
import { sbOne } from '@/lib/supabase';
import { callRoomName, callRingChannelName, broadcastEvent } from '@/lib/chat-channel';

/**
 * POST /api/calls/token?order=<id> — ระบบโทรจบในระบบ (in-system call)
 *
 * นโยบาย: ไม่มีบริการภายนอก — สื่อเสียง/ภาพวิ่ง P2P ผ่าน WebRTC ของเบราว์เซอร์ล้วน ๆ
 * (RTCPeerConnection แบบ iceServers: [] — ไม่มี LiveKit และไม่มีเซิร์ฟเวอร์ TURN/STUN)
 * เซิร์ฟเวอร์ทำหน้าที่แค่ตรวจสิทธิ์ผู้ร่วมออเดอร์ แจกชื่อช่องสัญญาณแบบคาดเดาไม่ได้
 * แล้วส่งสัญญาณ SDP/ICE ของสองฝ่ายผ่าน Supabase Broadcast (payload ไม่มีสื่อ — มีแค่สัญญาณ)
 */

interface CallOrderRow {
  id: string;
  customer_id: string;
  driver_id: string | null;
  status: string;
  order_code: string;
}

export async function POST(req: NextRequest) {
  try {
    const user = await currentUser();
    if (!user) return jsonError('กรุณาเข้าสู่ระบบ', 401);

    const orderId = req.nextUrl.searchParams.get('order') ?? '';
    if (!orderId) return jsonError('ไม่พบคำสั่งซื้อ', 400);

    // หมายเหตุ: orders ใช้คอลัมน์ customer_id (ไม่ใช่ user_id)
    const order = await sbOne<CallOrderRow>('orders', {
      id: `eq.${orderId}`,
      select: 'id,customer_id,driver_id,status,order_code',
    });
    if (!order) return jsonError('ไม่พบคำสั่งซื้อ', 404);

    // ผู้ร่วมโทรเท่านั้น: แอดมิน / ลูกค้าเจ้าของออเดอร์ / ไรเดอร์ผู้รับงาน
    const isParticipant =
      user.role === 'admin' || order.customer_id === user.id || order.driver_id === user.id;
    if (!isParticipant) return jsonError('ไม่ใช่ผู้ร่วมคำสั่งซื้อนี้ — โทรไม่ได้', 403);

    if (order.status === 'cancelled' || order.status === 'refunded') {
      return jsonError('ออเดอร์นี้ยกเลิกหรือคืนเงินแล้ว — โทรไม่ได้', 403);
    }

    // คู่สาย = อีกฝ่ายหนึ่งของออเดอร์ (ลูกค้า ↔ ไรเดอร์; แอดมินโทรหาไรเดอร์ก่อน ถ้าไม่มีไรเดอร์หาลูกค้า)
    const calleeId =
      user.id === order.customer_id
        ? order.driver_id
        : user.id === order.driver_id
          ? order.customer_id
          : (order.driver_id ?? order.customer_id);
    if (!calleeId || calleeId === user.id) {
      return jsonError('ยังไม่มีคู่สายในออเดอร์นี้ — ต้องมีไรเดอร์รับงานก่อนจึงจะโทรได้', 409);
    }

    const room = callRoomName(orderId);
    const calleeRing = callRingChannelName(calleeId);
    const expiresAt = new Date(Date.now() + 2 * 60 * 1000).toISOString(); // ชื่อช่องใช้ได้ 2 นาที

    // กริ่งฝั่งผู้รับ: broadcast {type:'incoming-call'} เข้าช่อง ring ส่วนตัวของคู่สาย (best-effort)
    await broadcastEvent(calleeRing, 'incoming-call', {
      type: 'incoming-call',
      room,
      orderId,
      orderCode: order.order_code,
      fromName: user.fullName,
    });

    return Response.json({ ok: true, room, orderCode: order.order_code, calleeRing, expiresAt });
  } catch (err) {
    console.error('calls/token error:', err);
    return jsonError('เริ่มการโทรไม่สำเร็จ', 500);
  }
}
