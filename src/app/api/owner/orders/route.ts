import { NextRequest } from 'next/server';
import { requireRole, getOwnerRestaurant } from '@/lib/portal';
import { sbList } from '@/lib/supabase';
import { jsonError } from '@/lib/api-user';

interface OrderRow {
  id: string;
  order_code: string;
  status: string;
  subtotal: number;
  delivery_fee: number;
  promotion_discount: number;
  total: number;
  notes: string | null;
  created_at: string;
  customer_id: string;
}

interface ItemRow {
  order_id: string;
  name_snapshot: string;
  quantity: number;
  unit_price: number;
}

interface CustomerRow {
  id: string;
  full_name: string;
  phone: string | null;
}

/** GET /api/owner/orders — ออเดอร์ของร้านฉัน (แอคทีฟ + ประวัติวันนี้) พร้อมรายการอาหารและผู้สั่ง */
export async function GET(_req: NextRequest) {
  const user = await requireRole('restaurant');
  if (!user) return jsonError('เฉพาะเจ้าของร้านเท่านั้น', 403);
  const owner = await getOwnerRestaurant(user.id);
  if (!owner) return jsonError('บัญชีนี้ยังไม่ผูกกับร้านอาหาร', 404);

  const orders = await sbList<OrderRow>('orders', {
    restaurant_id: `eq.${owner.restaurantId}`,
    select: 'id,order_code,status,subtotal,delivery_fee,promotion_discount,total,notes,created_at,customer_id',
    order: 'created_at.desc',
    limit: '60',
  });

  const ids = orders.map((o) => o.id);
  const items = ids.length
    ? await sbList<ItemRow>('order_items', {
        order_id: `in.(${ids.join(',')})`,
        select: 'order_id,name_snapshot,quantity,unit_price',
        limit: '500',
      })
    : [];
  const customerIds = [...new Set(orders.map((o) => o.customer_id))];
  const customers = customerIds.length
    ? await sbList<CustomerRow>('users', {
        id: `in.(${customerIds.join(',')})`,
        select: 'id,full_name,phone',
        limit: '200',
      })
    : [];

  const ACTIVE = ['paid', 'restaurant_accepted', 'preparing', 'ready_for_pickup', 'driver_assigned', 'picked_up', 'delivering'];
  const bangkokToday = new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);

  const data = orders.map((o) => ({
    ...o,
    customer: customers.find((c) => c.id === o.customer_id) ?? null,
    items: items.filter((i) => i.order_id === o.id),
  }));

  return Response.json({
    data,
    active: data.filter((o) => ACTIVE.includes(o.status)),
    history: data.filter((o) => !ACTIVE.includes(o.status) && o.created_at >= `${bangkokToday}T00:00:00+07:00`),
  });
}
