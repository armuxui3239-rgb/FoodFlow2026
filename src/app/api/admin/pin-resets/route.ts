import { NextRequest } from 'next/server';
import { requireRole } from '@/lib/portal';
import { sbList } from '@/lib/supabase';
import { jsonError } from '@/lib/api-user';

interface PinResetRow {
  id: string;
  user_id: string;
  status: string;
  expires_at: string;
  reviewed_at: string | null;
  review_note: string | null;
  created_at: string;
  users?: { full_name: string | null; phone: string | null; email: string | null } | null;
}

/** GET /api/admin/pin-resets — คำขอรีเซ็ต PIN (pending ก่อน) สำหรับหน้าอนุมัติ (เฟส 6 รอบสอง / v4 ข้อ 4.5) */
export async function GET(_req: NextRequest) {
  const admin = await requireRole('admin');
  if (!admin) return jsonError('เฉพาะผู้ดูแลระบบเท่านั้น', 403);

  const rows = await sbList<PinResetRow>('password_reset_tokens', {
    order: 'created_at.desc',
    limit: '100',
    select:
      'id,user_id,status,expires_at,reviewed_at,review_note,created_at,users!password_reset_tokens_user_id_fkey(full_name,phone,email)',
  });

  const pending = rows.filter((r) => r.status === 'pending');
  const rest = rows.filter((r) => r.status !== 'pending');
  return Response.json({ data: [...pending, ...rest] });
}
