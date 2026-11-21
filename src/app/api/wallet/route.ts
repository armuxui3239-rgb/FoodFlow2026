import { sbList } from '@/lib/supabase';
import { currentUser, jsonError } from '@/lib/api-user';
import { getWalletBalance } from '@/lib/wallet';

interface WalletTxRow {
  id: string;
  amount_delta: number;
  type: string;
  reason: string | null;
  ref_id: string | null;
  created_at: string;
  status: string;
}

/** GET — ยอดเงินคงเหลือ + ประวัติรายการกระเป๋าเงินของผู้ใช้ปัจจุบัน */
export async function GET() {
  const user = await currentUser();
  if (!user) return jsonError('กรุณาเข้าสู่ระบบ', 401);

  const [transactions, balance] = await Promise.all([
    sbList<WalletTxRow>('wallet_transactions', {
      user_id: `eq.${user.id}`,
      select: 'id,amount_delta,type,reason,ref_id,created_at,status',
      order: 'created_at.desc',
      limit: '50',
    }),
    getWalletBalance(user.id),
  ]);

  return Response.json({ data: { balance, transactions } });
}
