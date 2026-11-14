import { sbList } from '@/lib/supabase';

/** GET /api/cancellation-reasons — เหตุผลยกเลิกที่เปิดใช้งาน (สาธารณะ — เฉพาะข้อความ) */
export async function GET() {
  const rows = await sbList<{ id: string; label: string }>('cancellation_reasons', {
    is_active: 'eq.true',
    order: 'sort_order.asc',
    limit: '50',
    select: 'id,label',
  });
  return Response.json({ data: rows });
}
