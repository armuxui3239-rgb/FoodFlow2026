import { sbList, sbOne } from '@/lib/supabase';
import { currentUser, jsonError } from '@/lib/api-user';
import { decodeWkbPoint, haversineKm } from '@/lib/geo';

interface OrderRow {
  id: string;
  order_code: string;
  status: string;
  total: number;
  created_at: string;
  delivery_address_id: string | null;
  restaurants: { name: string; location: string } | null;
}

interface HistoryRow {
  id: string;
  status: string;
  note: string | null;
  created_at: string;
}

interface TaskRow {
  id: string;
  driver_id: string | null;
  status: string;
  assigned_at: string | null;
  picked_up_at: string | null;
  delivered_at: string | null;
}

interface DriverRow {
  id: string;
  full_name: string;
  avatar_url: string | null;
}

/** GET — ข้อมูลติดตามคำสั่งซื้อ: ออเดอร์ + ประวัติสถานะ + งานจัดส่ง (ต้องเป็นออเดอร์ของผู้ใช้เอง) */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return jsonError('กรุณาเข้าสู่ระบบ', 401);
  const { id } = await ctx.params;

  const order = await sbOne<OrderRow>('orders', {
    id: `eq.${id}`,
    customer_id: `eq.${user.id}`,
    select: 'id,order_code,status,total,created_at,delivery_address_id,restaurants(name,location)',
  });
  if (!order) return jsonError('ไม่พบคำสั่งซื้อ', 404);

  const history = await sbList<HistoryRow>('order_status_history', {
    order_id: `eq.${id}`,
    select: 'id,status,note,created_at',
    order: 'created_at.asc',
  });

  const task = await sbOne<TaskRow>('delivery_tasks', {
    order_id: `eq.${id}`,
    select: 'id,driver_id,status,assigned_at,picked_up_at,delivered_at',
  });

  const driver = task?.driver_id
    ? await sbOne<DriverRow>('users', {
        id: `eq.${task.driver_id}`,
        select: 'id,full_name,avatar_url',
      })
    : null;

  // ETA ค่าประมาณ (v4 ข้อ 3): ระยะเส้นตรงร้าน→จุดส่ง ÷ ความเร็วเฉลี่ย 25 กม./ชม. — ระบุชัดว่าค่าประมาณ
  let distanceKm: number | null = null;
  let etaMinutes: number | null = null;
  const fromPoint = decodeWkbPoint(order.restaurants?.location ?? null);
  const toPoint = order.delivery_address_id
    ? decodeWkbPoint(
        (
          await sbOne<{ location: string }>('addresses', {
            id: `eq.${order.delivery_address_id}`,
            select: 'location',
          })
        )?.location ?? null,
      )
    : null;
  if (fromPoint && toPoint) {
    distanceKm = Math.round(haversineKm(fromPoint, toPoint) * 10) / 10;
    etaMinutes = Math.max(3, Math.ceil((distanceKm / 25) * 60));
  }

  return Response.json({
    data: { order, history, task, driver, eta: { distanceKm, etaMinutes } },
  });
}
