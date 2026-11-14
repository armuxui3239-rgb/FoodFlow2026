import { NextRequest } from 'next/server';
import { requireRole, getOwnerRestaurant } from '@/lib/portal';
import { sbList, sbOne } from '@/lib/supabase';
import { jsonError } from '@/lib/api-user';

interface OrderRow {
  created_at: string;
  subtotal: number;
  commission_rate_at_order_time: number;
}

interface PayoutRow {
  id: string;
  order_id: string;
  amount: number;
  currency: string;
  status: string;
  settled_at: string | null;
  created_at: string;
}

/** เลื่อนวันที่แบบเวลาไทย (YYYY-MM-DD) */
function shiftDate(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * GET /api/owner/revenue — รายได้ของร้านฉัน
 * คำนวณจากออเดอร์ delivered/completed: gross = subtotal, คอม = round(subtotal × rate%), net = gross − คอม
 * ช่วงเวลา: วันนี้ / 7 วัน / 30 วัน (เขตเวลาไทย +07:00) + รายการตั้งเวลารับเงิน (payout_ledger) + เบอร์ร้าน
 */
export async function GET(_req: NextRequest) {
  const user = await requireRole('restaurant');
  if (!user) return jsonError('เฉพาะเจ้าของร้านเท่านั้น', 403);
  const owner = await getOwnerRestaurant(user.id);
  if (!owner) return jsonError('บัญชีนี้ยังไม่ผูกกับร้านอาหาร', 404);

  const bangkokToday = new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);

  const orders = await sbList<OrderRow>('orders', {
    restaurant_id: `eq.${owner.restaurantId}`,
    status: 'in.(delivered,completed)',
    select: 'created_at,subtotal,commission_rate_at_order_time',
    created_at: `gte.${shiftDate(bangkokToday, -29)}T00:00:00+07:00`,
    limit: '2000',
  });

  const summarize = (fromDay: string) => {
    const fromIso = `${fromDay}T00:00:00+07:00`;
    let gross = 0;
    let commission = 0;
    let count = 0;
    for (const o of orders) {
      if (o.created_at < fromIso) continue;
      count += 1;
      gross += Number(o.subtotal);
      // commission_rate_at_order_time เก็บเป็นเปอร์เซ็นต์ (เช่น 12 = 12%) — ต้องหาร 100
      commission += Math.round(Number(o.subtotal) * (Number(o.commission_rate_at_order_time) / 100));
    }
    return { gross, commission, net: gross - commission, orders: count };
  };

  const payouts = await sbList<PayoutRow>('payout_ledger', {
    recipient_type: 'eq.restaurant',
    recipient_id: `eq.${owner.restaurantId}`,
    select: 'id,order_id,amount,currency,status,settled_at,created_at',
    order: 'created_at.desc',
    limit: '30',
  });

  const rst = await sbOne<{ phone: string | null }>('restaurants', {
    id: `eq.${owner.restaurantId}`,
    select: 'phone',
  });

  return Response.json({
    today: summarize(bangkokToday),
    d7: summarize(shiftDate(bangkokToday, -6)),
    d30: summarize(shiftDate(bangkokToday, -29)),
    payouts,
    phone: rst?.phone ?? null,
  });
}
