import { NextRequest } from 'next/server';
import { requireRole } from '@/lib/portal';
import { sbList } from '@/lib/supabase';
import { jsonError } from '@/lib/api-user';

/** GET /api/points — แต้มสะสมของฉัน (loyalty_transactions จริง) */
export async function GET(_req: NextRequest) {
  const user = await requireRole('customer');
  if (!user) return jsonError('กรุณาเข้าสู่ระบบ', 401);

  const rows = await sbList<{ id: string; points: number; type: string; description: string | null; order_id: string | null; created_at: string }>(
    'loyalty_transactions',
    {
      user_id: `eq.${user.id}`,
      select: 'id,points,type,description,order_id,created_at',
      order: 'created_at.desc',
      limit: '50',
    },
  );
  const total = rows.reduce((s, r) => s + Number(r.points ?? 0), 0);
  return Response.json({ total, data: rows });
}
