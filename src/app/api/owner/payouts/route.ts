import { NextRequest } from 'next/server';
import { requireRole } from '@/lib/portal';
import { sbList } from '@/lib/supabase';
import { jsonError } from '@/lib/api-user';

interface PayoutRow {
  id: string;
  amount: number;
  status: string;
  settlement_batch_id: string | null;
  created_at: string;
  settled_at: string | null;
}

/** GET /api/owner/payouts — ประวัติการโอนรายได้ของร้านฉัน (ศูนย์ควบคุมบันทึก + ยืนยันโอน) */
export async function GET(_req: NextRequest) {
  const user = await requireRole('restaurant');
  if (!user) return jsonError('เฉพาะเจ้าของร้านเท่านั้น', 403);

  const rows = await sbList<PayoutRow>('payout_ledger', {
    recipient_type: 'eq.restaurant',
    recipient_id: `eq.${user.id}`,
    order: 'created_at.desc',
    limit: '50',
    select: 'id,amount,status,settlement_batch_id,created_at,settled_at',
  });
  return Response.json({ data: rows });
}
