import { NextRequest } from 'next/server';
import { requireRole } from '@/lib/portal';
import { sbList } from '@/lib/supabase';
import { jsonError } from '@/lib/api-user';

interface AdminTopupRow {
  id: string;
  user_id: string;
  amount_delta: number;
  status: string;
  proof_url: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  created_at: string;
  users?: { full_name: string | null; phone: string | null } | null;
}

/** GET /api/admin/topups — รายการเติมเงินล่าสุด (pending ก่อน) สำหรับหน้าตรวจสลิป (เฟส 5.1) */
export async function GET(_req: NextRequest) {
  const admin = await requireRole('admin');
  if (!admin) return jsonError('เฉพาะผู้ดูแลระบบเท่านั้น', 403);

  const rows = await sbList<AdminTopupRow>('wallet_transactions', {
    type: 'eq.credit',
    reason: 'ilike.*เติมเงิน*',
    order: 'created_at.desc',
    limit: '100',
    select:
      // ระบุชื่อ FK ชัดเจน — หลังเพิ่ม reviewed_by -> users ทำให้ embed แบบ users(...) เป็นคลุมเครือ (PGRST201)
      'id,user_id,amount_delta,status,proof_url,reviewed_at,review_note,created_at,users!wallet_transactions_user_id_fkey(full_name,phone)',
  });

  const pending = rows.filter((r) => r.status === 'pending');
  const rest = rows.filter((r) => r.status !== 'pending');
  return Response.json({ data: [...pending, ...rest] });
}
