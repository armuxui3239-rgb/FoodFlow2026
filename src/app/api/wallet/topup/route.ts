import crypto from 'crypto';
import { NextRequest } from 'next/server';
import { sbInsert, sbOne, sbUpdate } from '@/lib/supabase';
import { currentUser, jsonError } from '@/lib/api-user';
import { promptPayPayload } from '@/lib/promptpay';
import QRCode from 'qrcode';

const ALLOWED_AMOUNTS = [50, 100, 200, 300, 500, 1000]; // หน่วยบาท (input จากผู้ใช้)
// ใช้เบอร์พร้อมเพย์จาก env PROMPTPAY_ID ก่อน ถ้าไม่มีใช้ fallback จาก env เดียวกับ orders/route.ts
const FALLBACK_PROMPTPAY = process.env.PROMPTPAY_FALLBACK_TARGET ?? '0812345678';

/** POST — สร้างรายการเติมเงิน (pending) พร้อมคิวอาร์โค้ดพร้อมเพย์ */
export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user) return jsonError('กรุณาเข้าสู่ระบบ', 401);

  const { amount } = (await req.json().catch(() => ({}))) as { amount?: number };
  if (!ALLOWED_AMOUNTS.includes(Number(amount))) {
    return jsonError('จำนวนเงินไม่ถูกต้อง กรุณาเลือก 50, 100, 200, 300, 500 หรือ 1,000 บาท', 400);
  }
  const value = Number(amount);
  const valueSatang = value * 100; // มาตรฐานฐานข้อมูล: เก็บเงินเป็นสตางค์เสมอ

  const [row] = await sbInsert<{ id: string; amount_delta: number }>('wallet_transactions', {
    user_id: user.id,
    amount_delta: valueSatang,
    type: 'credit', // enum WalletTxnType จริงมีแค่ credit/debit — เติมเงิน = credit
    status: 'pending',
    reason: 'เติมเงินผ่านพร้อมเพย์',
    ref_id: crypto.randomUUID(), // คอลัมน์ ref_id ใน Supabase เป็นชนิด uuid — ห้ามใส่สตริงอื่น
  });

  const target = process.env.PROMPTPAY_ID || FALLBACK_PROMPTPAY;
  const payload = promptPayPayload(target, valueSatang);
  const qrDataUrl = await QRCode.toDataURL(payload, { width: 320, margin: 1 });

  return Response.json(
    { data: { transactionId: row.id, qrDataUrl, amount: valueSatang } }, // ส่งกลับเป็นสตางค์ให้ UI ใช้ baht() แสดงผล
    { status: 201 },
  );
}

/** PATCH — จำลองการชำระเงินสำเร็จ (อนุญาตเฉพาะโหมดทดสอบ ห้ามใช้ใน production) */
export async function PATCH(req: NextRequest) {
  const user = await currentUser();
  if (!user) return jsonError('กรุณาเข้าสู่ระบบ', 401);
  if (process.env.NODE_ENV === 'production') {
    return jsonError('ห้ามจำลองการชำระเงินใน production', 403);
  }

  const { transactionId } = (await req.json().catch(() => ({}))) as { transactionId?: string };
  if (!transactionId) return jsonError('กรุณาระบุรายการเติมเงิน', 400);

  // ตรวจว่ารายการเป็นของผู้ใช้นี้และยังรอชำระอยู่ก่อนอนุมัติ
  const existing = await sbOne<{ id: string; status: string }>('wallet_transactions', {
    id: `eq.${transactionId}`,
    user_id: `eq.${user.id}`,
    select: 'id,status',
  });
  if (!existing) return jsonError('ไม่พบรายการเติมเงินนี้', 404);
  if (existing.status !== 'pending') return jsonError('รายการนี้ดำเนินการไปแล้ว', 409);

  const [updated] = await sbUpdate<{ id: string; status: string; amount_delta: number }>(
    'wallet_transactions',
    { id: `eq.${transactionId}`, user_id: `eq.${user.id}`, status: 'eq.pending' },
    { status: 'completed' },
  );
  if (!updated) return jsonError('รายการนี้ดำเนินการไปแล้ว', 409);

  return Response.json({
    data: { transactionId: updated.id, status: updated.status, amountDelta: updated.amount_delta },
  });
}
