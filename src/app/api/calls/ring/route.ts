import { currentUser, jsonError } from '@/lib/api-user';
import { callRingChannelName } from '@/lib/chat-channel';

/**
 * GET /api/calls/ring — ชื่อช่องกริ่งส่วนบุคคลของผู้ใช้ที่ล็อกอิน (ระบบโทรจบในระบบ)
 * คืน ring:{userId}:{hmac16} — คำนวณ HMAC ฝั่งเซิร์ฟเวอร์เท่านั้น จึงคาดเดาไม่ได้
 * client ใช้ชื่อนี้ subscribe รอ event 'incoming-call' เมื่อมีคู่สายกดโทร
 */
export async function GET() {
  const user = await currentUser();
  if (!user) return jsonError('กรุณาเข้าสู่ระบบ', 401);
  return Response.json({ ringChannel: callRingChannelName(user.id), userName: user.fullName });
}
