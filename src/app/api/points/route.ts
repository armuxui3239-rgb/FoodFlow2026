import { NextRequest } from 'next/server';
import { sbList } from '@/lib/supabase';
import { currentUser, jsonError } from '@/lib/api-user';
import { getLoyaltyPointsTotal } from '@/lib/wallet';

/** GET /api/points — แต้มสะสมของฉัน (loyalty_transactions จริง) */
export async function GET(_req: NextRequest) {
  const user = await currentUser();
  if (!user || user.role !== 'customer') return jsonError('กรุณาเข้าสู่ระบบ', 401);

  const [rows, total] = await Promise.all([
    sbList<{ id: string; points: number; type: string; description: string | null; order_id: string | null; created_at: string }>(
      'loyalty_transactions',
      {
        user_id: `eq.${user.id}`,
        select: 'id,points,type,description,order_id,created_at',
        order: 'created_at.desc',
        limit: '50',
      },
    ),
    getLoyaltyPointsTotal(user.id),
  ]);
  return Response.json({ total, data: rows });
}
