'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  BadgeCheck,
  ChefHat,
  ClipboardList,
  Clock,
  Package,
  Phone,
  RefreshCw,
  Wallet,
} from 'lucide-react';
import { api, baht, STATUS_TH } from '@/lib/client';
import { OwnerFooter, OwnerHeader } from '@/components/portal/owner-header';

interface OwnerMe {
  restaurant: { id: string; name: string; isOpen: boolean };
  stats: { todayOrders: number; incoming: number; active: number; revenueSatang: number };
}

interface OrderItem {
  name_snapshot: string;
  quantity: number;
  unit_price: number;
}

interface OwnerOrder {
  id: string;
  order_code: string;
  status: string;
  total: number;
  notes: string | null;
  created_at: string;
  customer: { full_name: string; phone: string | null } | null;
  items: OrderItem[];
}

/** ปุ่มถัดไปตามลำดับสถานะของร้าน */
const NEXT_ACTION: Record<string, { action: string; label: string }> = {
  paid: { action: 'accept', label: 'รับออเดอร์' },
  restaurant_accepted: { action: 'prepare', label: 'เริ่มทำอาหาร' },
  preparing: { action: 'ready', label: 'พร้อมส่งแล้ว' },
};

export default function OwnerPortalPage() {
  const [me, setMe] = useState<OwnerMe | null>(null);
  const [orders, setOrders] = useState<OwnerOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [tick, setTick] = useState(0);

  const load = useCallback(() => {
    Promise.all([api<OwnerMe>('/api/owner/me'), api<{ active: OwnerOrder[]; history: OwnerOrder[] }>('/api/owner/orders')])
      .then(([m, o]) => {
        setMe(m);
        setOrders([...o.active, ...o.history]);
        setError('');
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load, tick]);

  // ดึงข้อมูลใหม่อัตโนมัติทุก 15 วินาที — ร้านเปิดทิ้งไว้ได้
  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 15000);
    return () => clearInterval(t);
  }, []);

  const act = async (orderId: string, action: string) => {
    setBusyId(orderId);
    setError('');
    try {
      await api(`/api/owner/orders/${orderId}`, { method: 'PATCH', body: JSON.stringify({ action }) });
      setTick((x) => x + 1);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyId(null);
    }
  };

  const incoming = orders.filter((o) => o.status === 'paid');
  const kitchen = orders.filter((o) => ['restaurant_accepted', 'preparing'].includes(o.status));
  const withDriver = orders.filter((o) => ['ready_for_pickup', 'driver_assigned', 'picked_up', 'delivering'].includes(o.status));
  const done = orders.filter((o) => ['delivered', 'completed', 'cancelled', 'refunded'].includes(o.status));

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <OwnerHeader />

      <main className="mx-auto w-full max-w-5xl flex-1 space-y-6 px-4 py-5">
        {error && (
          <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </p>
        )}

        {/* สถิติวันนี้ */}
        <section aria-label="สถิติวันนี้" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: 'ออเดอร์วันนี้', value: me ? String(me.stats.todayOrders) : '–', Icon: ClipboardList, hot: false },
            { label: 'รอรับออเดอร์', value: me ? String(me.stats.incoming) : '–', Icon: BadgeCheck, hot: (me?.stats.incoming ?? 0) > 0 },
            { label: 'กำลังดำเนินการ', value: me ? String(me.stats.active) : '–', Icon: ChefHat, hot: false },
            { label: 'ยอดขายวันนี้', value: me ? baht(me.stats.revenueSatang) : '–', Icon: Wallet, hot: false },
          ].map(({ label, value, Icon, hot }) => (
            <div key={label} className={`rounded-3xl border p-4 ${hot ? 'border-[#FFC400] bg-[#FFF4CC]' : 'border-line bg-white'}`}>
              <Icon className="h-5 w-5 text-black" aria-hidden />
              <p className="mt-2 text-xl font-bold text-black">{value}</p>
              <p className="text-xs text-neutral-500">{label}</p>
            </div>
          ))}
        </section>

        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold text-black">คำสั่งซื้อของร้าน</h1>
          <button
            onClick={() => { setLoading(true); setTick((x) => x + 1); }}
            className="flex items-center gap-1.5 rounded-full border border-line px-3 py-2 text-xs font-semibold text-neutral-600 transition-colors hover:bg-neutral-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} aria-hidden /> รีเฟรช
          </button>
        </div>

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-40 animate-pulse rounded-3xl bg-neutral-100" />
            ))}
          </div>
        ) : (
          <div className="space-y-6">
            <OrderSection
              title="รอร้านรับออเดอร์"
              tone="incoming"
              orders={incoming}
              busyId={busyId}
              onAct={act}
              emptyText="ไม่มีออเดอร์รอรับ — เมื่อลูกค้าจ่ายเงินแล้วจะขึ้นที่นี่"
            />
            <OrderSection
              title="กำลังเตรียมในครัว"
              tone="kitchen"
              orders={kitchen}
              busyId={busyId}
              onAct={act}
              emptyText="ยังไม่มีออเดอร์ในครัว"
            />
            <OrderSection
              title="อยู่กับไรเดอร์ / พร้อมส่ง"
              tone="driver"
              orders={withDriver}
              busyId={busyId}
              onAct={act}
              emptyText="ไม่มีออเดอร์ที่รอไรเดอร์หรือกำลังจัดส่ง"
            />
            <OrderSection
              title="จบแล้ววันนี้"
              tone="done"
              orders={done}
              busyId={busyId}
              onAct={act}
              emptyText="ยังไม่มีออเดอร์ที่จบวันนี้"
            />
          </div>
        )}
      </main>

      <OwnerFooter />
    </div>
  );
}

function OrderSection({
  title,
  tone,
  orders,
  busyId,
  onAct,
  emptyText,
}: {
  title: string;
  tone: 'incoming' | 'kitchen' | 'driver' | 'done';
  orders: OwnerOrder[];
  busyId: string | null;
  onAct: (id: string, action: string) => void;
  emptyText: string;
}) {
  if (orders.length === 0) {
    return (
      <section aria-label={title}>
        <h2 className="mb-2 text-sm font-bold text-neutral-500">{title}</h2>
        <p className="rounded-3xl border border-dashed border-line px-4 py-6 text-center text-sm text-neutral-300">{emptyText}</p>
      </section>
    );
  }
  return (
    <section aria-label={title}>
      <h2 className="mb-2 flex items-center gap-2 text-sm font-bold text-black">
        {title}
        <span
          className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
            tone === 'incoming' ? 'bg-[#FFC400] text-black' : tone === 'kitchen' ? 'bg-black text-[#FFC400]' : 'bg-neutral-100 text-neutral-600'
          }`}
        >
          {orders.length}
        </span>
      </h2>
      <ul className="space-y-3">
        {orders.map((o) => {
          const next = NEXT_ACTION[o.status];
          return (
            <li key={o.id} className="rounded-3xl border border-line bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-black">#{o.order_code}</span>
                  <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                    o.status === 'paid' ? 'bg-[#FFC400] text-black' : ['delivered', 'completed'].includes(o.status) ? 'bg-black text-[#FFC400]' : 'bg-neutral-100 text-neutral-700'
                  }`}>
                    {STATUS_TH[o.status] ?? o.status}
                  </span>
                </div>
                <span className="flex items-center gap-1 text-[11px] text-neutral-400">
                  <Clock className="h-3.5 w-3.5" aria-hidden />
                  {new Date(o.created_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>

              <ul className="mt-2 space-y-0.5 text-sm text-neutral-700">
                {o.items.map((i, idx) => (
                  <li key={idx} className="flex justify-between gap-2">
                    <span className="truncate-1">{i.name_snapshot} × {i.quantity}</span>
                    <span className="shrink-0">{baht(i.unit_price * i.quantity)}</span>
                  </li>
                ))}
              </ul>

              {o.notes && (
                <p className="mt-2 rounded-2xl bg-[#FFF4CC] px-3 py-2 text-xs text-neutral-700">หมายเหตุ: {o.notes}</p>
              )}

              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-neutral-500">
                  {o.customer?.full_name ?? 'ลูกค้า'}
                  {o.customer?.phone && (
                    <span className="ml-2 inline-flex items-center gap-1">
                      <Phone className="h-3 w-3" aria-hidden /> {o.customer.phone}
                    </span>
                  )}
                </p>
                <p className="text-base font-bold text-black">{baht(o.total)}</p>
              </div>

              {next && (
                <button
                  onClick={() => onAct(o.id, next.action)}
                  disabled={busyId === o.id}
                  className="btn-brand mt-3 flex h-11 w-full items-center justify-center gap-2 text-sm disabled:opacity-50"
                >
                  {busyId === o.id ? <RefreshCw className="h-4 w-4 animate-spin" aria-hidden /> : <Package className="h-4 w-4" aria-hidden />}
                  {next.label}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
