import crypto from 'crypto';
import { NextRequest } from 'next/server';
import { requireRole } from '@/lib/portal';
import { sbList, sbInsert } from '@/lib/supabase';
import { jsonError } from '@/lib/api-user';

/** GET /api/admin/cancel-reasons — ทุกเหตุผล (รวมที่ปิด) สำหรับหน้าจัดการ */
export async function GET() {
  const admin = await requireRole('admin');
  if (!admin) return jsonError('เฉพาะผู้ดูแลระบบเท่านั้น', 403);
  const rows = await sbList<{ id: string; label: string; is_active: boolean; sort_order: number }>(
    'cancellation_reasons',
    { order: 'sort_order.asc', limit: '100', select: 'id,label,is_active,sort_order' },
  );
  return Response.json({ data: rows });
}

/** POST /api/admin/cancel-reasons — เพิ่มเหตุผลใหม่ body: { label } */
export async function POST(req: NextRequest) {
  const admin = await requireRole('admin');
  if (!admin) return jsonError('เฉพาะผู้ดูแลระบบเท่านั้น', 403);
  const { label } = (await req.json().catch(() => ({}))) as { label?: string };
  const clean = (label ?? '').trim();
  if (clean.length < 2 || clean.length > 200) {
    return jsonError('ข้อความเหตุผลต้องยาว 2–200 ตัวอักษร', 400);
  }
  const dupe = await sbList<{ id: string }>('cancellation_reasons', {
    label: `eq.${clean}`,
    select: 'id',
    limit: '1',
  });
  if (dupe.length) return jsonError('มีเหตุผลนี้อยู่แล้ว', 409);
  const all = await sbList<{ id: string }>('cancellation_reasons', { select: 'sort_order', limit: '100' });
  const [row] = await sbInsert<{ id: string; label: string }>('cancellation_reasons', {
    id: crypto.randomUUID(),
    label: clean,
    is_active: true,
    sort_order: all.length + 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
  return Response.json({ data: row }, { status: 201 });
}
