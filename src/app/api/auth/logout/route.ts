import { clearSessionCookieValue } from '@/lib/session';
import { currentUser } from '@/lib/api-user';
import { sbUpdate } from '@/lib/supabase';

/** POST /api/auth/logout — ลงชื่อออก: ยก session_version ฝั่งเซิร์ฟเวอร์ (cookie เดิม/อุปกรณ์อื่น ๆ เพิกถอนทันที)
 *  แก้ข้อพบ medium จากยืนยันรับมือ: เดิมล้างแค่ cookie ฝั่ง client — cookie ที่ถูกขโมย/จำไว้ยังใช้ได้จนครบ 7 วัน */
export async function POST() {
  const session = await currentUser();
  if (session) {
    try {
      await sbUpdate('users', { id: `eq.${session.id}` }, {
        session_version: (session.ver ?? 0) + 1,
        updated_at: new Date().toISOString(),
      });
    } catch {
      // ยกเวอร์ชันล้มเหลวยังล้าง cookie ให้เหมือนเดิม — ไม่ทำให้ logout พัง
    }
  }
  const res = Response.json({ ok: true });
  res.headers.append('Set-Cookie', clearSessionCookieValue());
  return res;
}
