import crypto from 'crypto';
import { sbInsert, sbOne } from '@/lib/supabase';
import { currentUser, jsonError } from '@/lib/api-user';

interface ReferralRow {
  id: string;
  user_id: string;
  code: string;
  created_at: string;
}

/** โค้ดเชิญ = 'FT' + ตัวอักษร/ตัวเลขสุ่ม 6 ตัว (A-Z, 0-9, ตัวใหญ่ทั้งหมด) */
const CODE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const CODE_BODY_LENGTH = 6;
const MAX_ATTEMPTS = 8;

function randomCodeBody(): string {
  let out = '';
  for (let i = 0; i < CODE_BODY_LENGTH; i++) {
    out += CODE_CHARS[crypto.randomInt(0, CODE_CHARS.length)];
  }
  return `FT${out}`;
}

/** สุ่มโค้ดแล้วตรวจซ้ำกับตาราง referral_codes จนกว่าจะไม่ชน */
async function generateUniqueCode(): Promise<string> {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const candidate = randomCodeBody();
    const dup = await sbOne<{ id: string }>('referral_codes', {
      code: `eq.${candidate}`,
      select: 'id',
    });
    if (!dup) return candidate;
  }
  throw new Error('สร้างโค้ดเชิญไม่สำเร็จ กรุณาลองอีกครั้ง');
}

/** GET — โค้ดเชิญของผู้ใช้ปัจจุบัน (ถ้ายังไม่มีจะสร้างให้อัตโนมัติ) */
export async function GET() {
  const user = await currentUser();
  if (!user) return jsonError('กรุณาเข้าสู่ระบบ', 401);

  let row = await sbOne<ReferralRow>('referral_codes', {
    user_id: `eq.${user.id}`,
    select: 'id,user_id,code,created_at',
    order: 'created_at.desc',
    limit: '1',
  });

  if (!row) {
    const code = await generateUniqueCode();
    const inserted = await sbInsert<ReferralRow>('referral_codes', {
      user_id: user.id,
      code,
      created_at: new Date().toISOString(),
    });
    row = inserted[0];
    if (!row) return jsonError('สร้างโค้ดเชิญไม่สำเร็จ กรุณาลองอีกครั้ง', 500);
  }

  // invitedCount: ควรนับจากตาราง referral_redemptions แต่ยังอยู่นอกขอบเขตงานนี้
  // (ยังไม่มี flow ผูก redemption กับผู้ใช้) — จึงใส่ 0 ไว้ก่อน จะอัปเดตในรอบถัดไป
  return Response.json({
    data: {
      code: row.code,
      createdAt: row.created_at,
      invitedCount: 0,
    },
  });
}
