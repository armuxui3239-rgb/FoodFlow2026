import { NextRequest } from 'next/server';
import { requireRole } from '@/lib/portal';
import { sbList, sbUpdate } from '@/lib/supabase';
import { jsonError } from '@/lib/api-user';

/** GET /api/admin/users — รายชื่อผู้ใช้ทั้งหมด ค้นหาได้ (q= ชื่อ/อีเมล/เบอร์, role=) */
export async function GET(req: NextRequest) {
  const user = await requireRole('admin');
  if (!user) return jsonError('เฉพาะผู้ดูแลระบบเท่านั้น', 403);

  const q = req.nextUrl.searchParams.get('q')?.trim() ?? '';
  const role = req.nextUrl.searchParams.get('role') ?? '';

  const params: Record<string, string> = {
    select: 'id,email,phone,full_name,role,is_active,preferred_locale,created_at',
    order: 'created_at.desc',
    limit: '100',
  };
  if (role) params.role = `eq.${role}`;
  if (q) params.or = `(full_name.ilike.*${q}*,email.ilike.*${q}*,phone.ilike.*${q}*)`;

  const rows = await sbList<{ id: string; email: string; phone: string | null; full_name: string; role: string; is_active: boolean; preferred_locale: string | null; created_at: string }>('users', params);

  return Response.json({ data: rows });
}

/** PATCH /api/admin/users — เปิด/ระงับบัญชี { userId, isActive } */
export async function PATCH(req: NextRequest) {
  const admin = await requireRole('admin');
  if (!admin) return jsonError('เฉพาะผู้ดูแลระบบเท่านั้น', 403);
  const { userId, isActive } = (await req.json().catch(() => ({}))) as { userId?: string; isActive?: boolean };
  if (!userId || typeof isActive !== 'boolean') return jsonError('กรุณาระบุ userId และ isActive', 400);
  // ห้ามระงับตัวเอง
  if (userId === admin.id && !isActive) return jsonError('ห้ามระงับบัญชีของตัวเอง', 400);
  const [updated] = await sbUpdate<{ id: string; is_active: boolean }>('users', { id: `eq.${userId}` }, { is_active: isActive });
  if (!updated) return jsonError('ไม่พบผู้ใช้นี้', 404);
  return Response.json({ ok: true, isActive: updated.is_active });
}
