import { NextRequest } from 'next/server';
import { requireRole } from '@/lib/portal';
import { sbList } from '@/lib/supabase';
import { jsonError } from '@/lib/api-user';

interface RefundRow {
  id: string;
  order_id: string;
  amount: number;
  kind: string;
  reason: string;
  method: string;
  status: string;
  requested_by: string | null;
  created_at: string;
  users: { full_name: string | null; email: string | null } | null;
  orders: { order_code: string; status: string } | null;
}

/** GET /api/admin/refunds — คำขอคืนเงินทั้งหมด (pending ก่อน) สำหรับหน้าตรวจ (D1) */
export async function GET(_req: NextRequest) {
  const admin = await requireRole('admin');
  if (!admin) return jsonError('เฉพาะผู้ดูแลระบบเท่านั้น', 403);

  const rows = await sbList<RefundRow>('payment_refund_requests', {
    order: 'created_at.desc',
    limit: '100',
    select:
      'id,order_id,amount,kind,reason,method,status,requested_by,created_at,users!payment_refund_requests_requested_by_fkey(full_name,email),orders(order_code,status)',
  });

  const pending = rows.filter((r) => r.status === 'pending');
  const rest = rows.filter((r) => r.status !== 'pending');
  return Response.json({ data: [...pending, ...rest] });
}
