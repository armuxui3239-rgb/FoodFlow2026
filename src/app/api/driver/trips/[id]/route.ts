import { NextRequest } from 'next/server';
import { requireRole } from '@/lib/portal';
import { sbList, sbOne } from '@/lib/supabase';
import { jsonError } from '@/lib/api-user';

interface OrderRow {
  id: string;
  order_code: string;
  status: string;
  delivery_fee: number;
  subtotal: number;
  delivery_address_id: string;
  restaurant_id: string;
  customer_id: string;
  created_at: string;
}

/** GET /api/driver/trips/[id] — รายละเอียดงานส่ง 1 งานของฉัน */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireRole('driver');
  if (!user) return jsonError('เฉพาะไรเดอร์เท่านั้น', 403);
  const { id } = await params;

  const task = await sbOne<{
    id: string;
    order_id: string;
    status: string;
    assigned_at: string | null;
    picked_up_at: string | null;
    delivered_at: string | null;
    delivery_distance_km: number | null;
  }>('delivery_tasks', {
    id: `eq.${id}`,
    driver_id: `eq.${user.id}`,
    select: 'id,order_id,status,assigned_at,picked_up_at,delivered_at,delivery_distance_km',
  });
  if (!task) return jsonError('ไม่พบงานนี้ของคุณ', 404);

  const order = await sbOne<OrderRow>('orders', {
    id: `eq.${task.order_id}`,
    select: 'id,order_code,status,delivery_fee,subtotal,delivery_address_id,restaurant_id,customer_id,created_at',
  });
  if (!order) return jsonError('ไม่พบข้อมูลออเดอร์ของงานนี้', 404);

  const [restaurant] = await sbList<{ id: string; name: string; address_line: string | null }>('restaurants', {
    id: `eq.${order.restaurant_id}`,
    select: 'id,name,address_line',
    limit: '1',
  });
  const [customer] = await sbList<{ id: string; full_name: string }>('users', {
    id: `eq.${order.customer_id}`,
    select: 'id,full_name',
    limit: '1',
  });
  const [address] = await sbList<{ id: string; label: string; address_line: string }>('addresses', {
    id: `eq.${order.delivery_address_id}`,
    select: 'id,label,address_line',
    limit: '1',
  });
  const items = await sbList<{ id: string; name_snapshot: string; quantity: number; unit_price: number }>('order_items', {
    order_id: `eq.${task.order_id}`,
    select: 'id,name_snapshot,quantity,unit_price',
    limit: '50',
  });
  const history = await sbList<{ id: string; status: string; created_at: string }>('order_status_history', {
    order_id: `eq.${task.order_id}`,
    select: 'id,status,created_at',
    order: 'created_at.asc.nullslast',
    limit: '30',
  });

  return Response.json({
    task: {
      id: task.id,
      status: task.status,
      assignedAt: task.assigned_at,
      pickedUpAt: task.picked_up_at,
      deliveredAt: task.delivered_at,
      distanceKm: task.delivery_distance_km,
    },
    order: {
      id: order.id,
      code: order.order_code,
      status: order.status,
      deliveryFeeSatang: Number(order.delivery_fee),
      subtotalSatang: Number(order.subtotal),
      dropoffLabel: address?.label ?? null,
      dropoffAddress: address?.address_line ?? null,
      createdAt: order.created_at,
    },
    restaurant: { name: restaurant?.name ?? '-', address: restaurant?.address_line ?? null },
    customerName: customer?.full_name ?? '-',
    items: items.map((i) => ({
      name: i.name_snapshot,
      quantity: i.quantity,
      unitPriceSatang: Number(i.unit_price),
    })),
    history,
  });
}
