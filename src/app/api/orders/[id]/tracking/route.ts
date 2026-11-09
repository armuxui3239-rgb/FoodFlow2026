import { sbList, sbOne } from '@/lib/supabase';
import { currentUser, jsonError } from '@/lib/api-user';

interface OrderRow {
  id: string;
  order_code: string;
  status: string;
  total: number;
  created_at: string;
  restaurants: { name: string } | null;
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
    select: 'id,order_code,status,total,created_at,restaurants(name)',
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

  return Response.json({ data: { order, history, task, driver } });
}
