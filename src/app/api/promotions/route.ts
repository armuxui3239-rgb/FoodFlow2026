import { sbList } from '@/lib/supabase';

export interface PromotionRow {
  id: string;
  code: string;
  type: string;
  value: number | null;
  min_order_amount: number | null;
  max_discount: number | null;
  name: string;
  description: string | null;
  expires_at: string | null;
  first_order_only: boolean | null;
  restaurant_id: string | null;
}

const SELECT =
  'id,code,type,value,min_order_amount,max_discount,name,description,expires_at,first_order_only,restaurant_id';

/**
 * GET /api/promotions — ข้อเสนอ/คูปองที่ใช้ได้ตอนนี้ (public ไม่ต้อง login)
 * เงื่อนไข: is_active = true AND status = 'active' AND expires_at >= ปัจจุบัน
 */
export async function GET() {
  try {
    const now = new Date().toISOString();
    const data = await sbList<PromotionRow>('promotions', {
      is_active: 'eq.true',
      status: 'eq.active',
      expires_at: `gte.${now}`,
      select: SELECT,
      order: 'created_at.desc',
      limit: '20',
    });
    return Response.json({ data });
  } catch {
    return Response.json({ error: 'โหลดข้อเสนอไม่สำเร็จ กรุณาลองอีกครั้ง' }, { status: 500 });
  }
}
