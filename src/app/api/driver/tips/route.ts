import { NextRequest } from 'next/server';
import { requireRole } from '@/lib/portal';
import { sbList } from '@/lib/supabase';
import { jsonError } from '@/lib/api-user';

interface TipRow {
  id: string;
  order_id: string;
  amount: number;
  status: string;
  created_at: string;
}

/** GET /api/driver/tips — ทิปจากลูกค้า (driver_tip_reports) + รวมทั้งหมด */
export async function GET(_req: NextRequest) {
  const user = await requireRole('driver');
  if (!user) return jsonError('เฉพาะไรเดอร์เท่านั้น', 403);

  const rows = await sbList<TipRow>('driver_tip_reports', {
    driver_id: `eq.${user.id}`,
    select: 'id,order_id,amount,status,created_at',
    order: 'created_at.desc.nullslast',
    limit: '50',
  });

  const orderIds = [...new Set(rows.map((r) => r.order_id))];
  const orders = orderIds.length
    ? await sbList<{ id: string; order_code: string }>('orders', {
        id: `in.(${orderIds.join(',')})`,
        select: 'id,order_code',
        limit: '100',
      })
    : [];
  const codeByOrder = new Map(orders.map((o) => [o.id, o.order_code]));

  const totalSatang = rows.reduce((s, r) => s + Number(r.amount), 0);

  return Response.json({
    totalSatang,
    data: rows.map((r) => ({
      id: r.id,
      orderCode: codeByOrder.get(r.order_id) ?? '-',
      amountSatang: Number(r.amount),
      status: r.status,
      createdAt: r.created_at,
    })),
  });
}
