import { NextRequest } from 'next/server';
import { requireRole } from '@/lib/portal';
import { sbList } from '@/lib/supabase';
import { jsonError } from '@/lib/api-user';

interface CampaignRow {
  id: string;
  title: string;
  reward_amount: number;
  target_orders: number;
  starts_at: string;
  ends_at: string;
}

/** GET /api/driver/incentives — โบนัสรับงานที่เปิดอยู่ + ความคืบหน้าจริงของฉัน */
export async function GET(_req: NextRequest) {
  const user = await requireRole('driver');
  if (!user) return jsonError('เฉพาะไรเดอร์เท่านั้น', 403);

  const nowIso = new Date().toISOString();
  const campaigns = await sbList<CampaignRow>('driver_incentive_campaigns', {
    is_active: 'eq.true',
    ends_at: `gte.${nowIso}`,
    select: 'id,title,reward_amount,target_orders,starts_at,ends_at',
    order: 'ends_at.asc.nullslast',
    limit: '20',
  });

  // ดึงงานส่งสำเร็จของฉันตั้งแต่เริ่มแคมเปญแรกสุด แล้วนับตามช่วงเวลาของแต่ละแคมเปญ
  const earliest = campaigns.reduce<string | null>(
    (min, c) => (min === null || c.starts_at < min ? c.starts_at : min),
    null,
  );
  let tasks: { delivered_at: string | null }[] = [];
  if (earliest) {
    tasks = await sbList<{ delivered_at: string | null }>('delivery_tasks', {
      driver_id: `eq.${user.id}`,
      status: 'eq.delivered',
      delivered_at: `gte.${earliest}`,
      select: 'delivered_at',
      order: 'delivered_at.desc.nullslast',
      limit: '2000',
    });
  }

  return Response.json({
    data: campaigns.map((c) => {
      const progress = tasks.filter((t) => t.delivered_at && t.delivered_at >= c.starts_at && t.delivered_at <= c.ends_at).length;
      return {
        id: c.id,
        title: c.title,
        rewardSatang: Number(c.reward_amount),
        targetOrders: c.target_orders,
        startsAt: c.starts_at,
        endsAt: c.ends_at,
        progress: Math.min(progress, c.target_orders),
      };
    }),
  });
}
