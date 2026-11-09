import { NextRequest } from 'next/server';
import { requireRole } from '@/lib/portal';
import { sbList, sbUpdate } from '@/lib/supabase';
import { jsonError } from '@/lib/api-user';

/** GET /api/admin/approvals — ร้านทั้งหมดพร้อมสถานะอนุมัติ */
export async function GET(_req: NextRequest) {
  const user = await requireRole('admin');
  if (!user) return jsonError('เฉพาะผู้ดูแลระบบเท่านั้น', 403);
  const restaurants = await sbList<{
    id: string;
    name: string;
    slug: string;
    is_open: boolean;
    is_active: boolean;
    approval_status: string;
    rating: number | null;
  }>('restaurants', {
    select: 'id,name,slug,is_open,is_active,approval_status,rating',
    order: 'name.asc',
    limit: '200',
  });
  return Response.json({ data: restaurants });
}

/**
 * PATCH /api/admin/approvals — เปลี่ยนสถานะร้าน
 * { restaurantId, approvalStatus?: 'approved'|'pending'|'rejected'|'suspended', isActive?, isOpen? }
 */
export async function PATCH(req: NextRequest) {
  const admin = await requireRole('admin');
  if (!admin) return jsonError('เฉพาะผู้ดูแลระบบเท่านั้น', 403);
  const { restaurantId, approvalStatus, isActive, isOpen } = (await req.json().catch(() => ({}))) as {
    restaurantId?: string;
    approvalStatus?: string;
    isActive?: boolean;
    isOpen?: boolean;
  };
  if (!restaurantId) return jsonError('กรุณาระบุ restaurantId', 400);
  const patch: Record<string, unknown> = {};
  if (approvalStatus) {
    if (!['approved', 'pending', 'rejected', 'suspended'].includes(approvalStatus)) {
      return jsonError('approvalStatus ไม่ถูกต้อง', 400);
    }
    patch.approval_status = approvalStatus;
  }
  if (typeof isActive === 'boolean') patch.is_active = isActive;
  if (typeof isOpen === 'boolean') patch.is_open = isOpen;
  if (Object.keys(patch).length === 0) return jsonError('ไม่มีข้อมูลที่จะแก้', 400);

  const [updated] = await sbUpdate<{ id: string }>('restaurants', { id: `eq.${restaurantId}` }, patch);
  if (!updated) return jsonError('ไม่พบร้านนี้', 404);
  return Response.json({ ok: true });
}
