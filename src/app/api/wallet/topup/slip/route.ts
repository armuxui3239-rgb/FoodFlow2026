import { NextRequest } from 'next/server';
import { sbOne, sbUpdate, sbHeaders } from '@/lib/supabase';
import { currentUser, jsonError } from '@/lib/api-user';

const MAX_BYTES = 5 * 1024 * 1024; // 5MB
const OK_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

/** POST /api/wallet/topup/slip — แนบสลิปหลังโอนเงิน (FormData: transactionId + slip)
 *  เก็บขึ้น Supabase Storage bucket topup-slips (private) แล้วบันทึกพาธใน proof_url
 *  สถานะยังคง pending — รอแอดมินตรวจสลิป (เฟส 5.1) */
export async function POST(req: NextRequest) {
  try {
    const user = await currentUser();
    if (!user) return jsonError('กรุณาเข้าสู่ระบบ', 401);

    const form = await req.formData().catch(() => null);
    if (!form) return jsonError('รูปแบบคำขอไม่ถูกต้อง', 400);

    const transactionId = String(form.get('transactionId') ?? '');
    const file = form.get('slip');
    if (!transactionId) return jsonError('กรุณาระบุรายการเติมเงิน', 400);
    if (!file || typeof file === 'string') return jsonError('กรุณาแนบไฟล์สลิป', 400);
    if (!OK_TYPES.includes(file.type)) return jsonError('รองรับเฉพาะไฟล์ PNG/JPG/WEBP', 400);
    if (file.size > MAX_BYTES) return jsonError('ไฟล์ใหญ่เกิน 5MB', 400);

    const tx = await sbOne<{ id: string; status: string }>('wallet_transactions', {
      id: `eq.${transactionId}`,
      user_id: `eq.${user.id}`,
      type: 'eq.credit',
      select: 'id,status',
    });
    if (!tx) return jsonError('ไม่พบรายการเติมเงินนี้', 404);
    if (tx.status !== 'pending') return jsonError('รายการนี้ดำเนินการไปแล้ว', 409);

    const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
    const objectPath = `${user.id}/${transactionId}-${Date.now()}.${ext}`;
    const bytes = Buffer.from(await file.arrayBuffer());

    const upRes = await fetch(
      `${process.env.SUPABASE_URL}/storage/v1/object/topup-slips/${objectPath}`,
      {
        method: 'POST',
        headers: { ...sbHeaders(), 'Content-Type': file.type },
        body: new Uint8Array(bytes),
      },
    );
    if (!upRes.ok) {
      console.error('slip upload failed:', upRes.status, await upRes.text().catch(() => ''));
      return jsonError('อัปโหลดสลิปไม่สำเร็จ กรุณาลองใหม่', 500);
    }

    await sbUpdate(
      'wallet_transactions',
      { id: `eq.${transactionId}`, user_id: `eq.${user.id}`, status: 'eq.pending' },
      { proof_url: objectPath },
    );

    return Response.json({ data: { ok: true, status: 'pending' } });
  } catch (err) {
    console.error('topup slip error:', err);
    return jsonError('แนบสลิปไม่สำเร็จ กรุณาลองใหม่', 500);
  }
}
