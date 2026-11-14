'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, ChefHat, CheckCircle2, Clock, Inbox, Package, RefreshCw, Store } from 'lucide-react';
import { api, baht, STATUS_TH, useSession } from '@/lib/client';

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

/** ปุ่มถัดไปตามลำดับสถานะของร้าน (เหมือน OWNER_TRANSITIONS ฝั่งเซิร์ฟเวอร์) */
const NEXT_ACTION: Record<string, { action: string; label: string }> = {
  paid: { action: 'accept', label: 'รับออเดอร์' },
  restaurant_accepted: { action: 'prepare', label: 'เริ่มทำอาหาร' },
  preparing: { action: 'ready', label: 'พร้อมส่งแล้ว' },
};

const COLUMNS: { key: string; title: string; statuses: string[]; empty: string; Icon: typeof Inbox }[] = [
  { key: 'new', title: 'มาใหม่', statuses: ['paid'], empty: 'ไม่มีออเดอร์ใหม่', Icon: Inbox },
  { key: 'kitchen', title: 'กำลังเตรียม', statuses: ['restaurant_accepted', 'preparing'], empty: 'ยังไม่มีออเดอร์ในครัว', Icon: ChefHat },
  { key: 'delivering', title: 'พร้อมส่ง / กำลังจัดส่ง', statuses: ['ready_for_pickup', 'driver_assigned', 'picked_up', 'delivering'], empty: 'ไม่มีออเดอร์รอไรเดอร์', Icon: Package },
  { key: 'done', title: 'สำเร็จ', statuses: ['delivered', 'completed'], empty: 'ยังไม่มีออเดอร์ที่สำเร็จ', Icon: CheckCircle2 },
];

/** คอร์บอร์ดออเดอร์ของร้าน — 4 คอลัมน์ อัปเดตอัตโนมัติทุก 15 วินาที */
export default function OwnerOrderBoardPage() {
  const { user, ready } = useSession();
  const [orders, setOrders] = useState<OwnerOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [tick, setTick] = useState(0);

  const load = useCallback(() => {
    api<{ data: OwnerOrder[] }>('/api/owner/orders')
      .then((d) => {
        setOrders(d.data ?? []);
        setError('');
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load, tick]);

  // ดึงข้อมูลใหม่อัตโนมัติทุก 15 วินาที
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

  const denied = ready && (!user || user.role !== 'restaurant');

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <header className="sticky top-0 z-40 border-b border-line bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-2 px-4">
          <Link
            href="/owner"
            aria-label="ย้อนกลับ"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-neutral-100 transition-transform active:scale-95"
          >
            <ArrowLeft className="h-5 w-5" aria-hidden />
          </Link>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#FFC400] text-black">
            <Store className="h-5 w-5" aria-hidden />
          </span>
          <h1 className="min-w-0 truncate-1 text-sm font-bold text-black">คอร์บอร์ดออเดอร์</h1>
          <button
            onClick={() => { setLoading(true); setTick((x) => x + 1); }}
            className="ml-auto flex items-center gap-1.5 rounded-full border border-line px-3 py-2 text-xs font-semibold text-neutral-600 transition-colors hover:bg-neutral-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} aria-hidden /> รีเฟรช
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 space-y-4 px-4 py-5">
        {denied && (
          <p role="alert" className="rounded-2xl bg-[#FFF4CC] px-4 py-3 text-sm font-semibold text-black">
            หน้านี้สำหรับเจ้าของร้านเท่านั้น กรุณาเข้าสู่ระบบด้วยบัญชีร้านค้า
          </p>
        )}
        {error && (
          <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </p>
        )}

        {loading ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-64 animate-pulse rounded-3xl bg-neutral-100" />
            ))}
          </div>
        ) : (
          <div className="grid items-start gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {COLUMNS.map((col) => {
              const colOrders = orders.filter((o) => col.statuses.includes(o.status));
              return (
                <section key={col.key} aria-label={col.title} className="rounded-3xl border border-line bg-neutral-50/60 p-3">
                  <h2 className="mb-2 flex items-center gap-2 text-sm font-bold text-black">
                    <col.Icon className="h-4 w-4 text-neutral-500" aria-hidden />
                    {col.title}
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                        colOrders.length > 0 ? 'bg-[#FFC400] text-black' : 'bg-neutral-100 text-neutral-400'
                      }`}
                    >
                      {colOrders.length}
                    </span>
                  </h2>

                  {colOrders.length === 0 ? (
                    <p className="rounded-2xl border border-dashed border-line px-3 py-6 text-center text-xs text-neutral-300">
                      {col.empty}
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {colOrders.map((o) => {
                        const next = NEXT_ACTION[o.status];
                        return (
                          <li key={o.id} className="rounded-2xl border border-line bg-white p-3 shadow-sm">
                            <div className="flex items-center justify-between gap-2">
                              <Link href={`/owner/orders/${o.id}`} className="text-sm font-bold text-black hover:underline">
                                #{o.order_code}
                              </Link>
                              <span className="flex items-center gap-1 text-[11px] text-neutral-400">
                                <Clock className="h-3.5 w-3.5" aria-hidden />
                                {new Date(o.created_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <Link href={`/owner/orders/${o.id}`} className="mt-1 block">
                              <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-bold ${
                                o.status === 'paid' ? 'bg-[#FFC400] text-black' : ['delivered', 'completed'].includes(o.status) ? 'bg-black text-[#FFC400]' : 'bg-neutral-100 text-neutral-700'
                              }`}>
                                {STATUS_TH[o.status] ?? o.status}
                              </span>
                              <ul className="mt-1.5 space-y-0.5 text-xs text-neutral-600">
                                {o.items.slice(0, 3).map((i, idx) => (
                                  <li key={idx} className="flex justify-between gap-2">
                                    <span className="truncate-1">{i.name_snapshot} × {i.quantity}</span>
                                  </li>
                                ))}
                                {o.items.length > 3 && <li className="text-neutral-400">+{o.items.length - 3} รายการ</li>}
                              </ul>
                              <p className="mt-1.5 flex items-center justify-between text-xs">
                                <span className="truncate-1 text-neutral-500">{o.customer?.full_name ?? 'ลูกค้า'}</span>
                                <span className="shrink-0 text-sm font-bold text-black">{baht(o.total)}</span>
                              </p>
                            </Link>
                            {next && (
                              <button
                                onClick={() => void act(o.id, next.action)}
                                disabled={busyId === o.id}
                                className="btn-brand mt-2 flex h-10 w-full items-center justify-center gap-1.5 text-xs disabled:opacity-50"
                              >
                                <RefreshCw className={`h-3.5 w-3.5 ${busyId === o.id ? 'animate-spin' : ''}`} aria-hidden />
                                {next.label}
                              </button>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </main>

      <footer className="mt-auto border-t border-line bg-white pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-4 text-center text-xs text-neutral-400">
        © {new Date().getFullYear()} ฟู๊ด ธันเดอร์ — พอร์ทัลร้านค้า
      </footer>
    </div>
  );
}
