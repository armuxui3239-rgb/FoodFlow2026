import { NextRequest } from 'next/server';
import { requireRole } from '@/lib/portal';
import { sbList } from '@/lib/supabase';
import { jsonError } from '@/lib/api-user';

/** GET /api/admin/support-macros — ข้อความสำเร็จรูปที่เปิดใช้งาน (สำหรับช่องตอบกลับ) */
export async function GET(_req: NextRequest) {
  const admin = await requireRole('admin');
  if (!admin) return jsonError('เฉพาะผู้ดูแลระบบเท่านั้น', 403);

  const macros = await sbList<{
    id: string;
    name: string;
    body: string;
    tags: string[] | null;
    is_active: boolean;
    created_at: string;
  }>('support_macros', {
    is_active: 'eq.true',
    select: 'id,name,body,tags,is_active,created_at',
    order: 'name.asc',
    limit: '50',
  });

  return Response.json({ data: macros });
}
