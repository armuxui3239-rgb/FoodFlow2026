'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { ClipboardList, Clock, RefreshCw, Search } from 'lucide-react';
import { api, baht, STATUS_TH } from '@/lib/client';
import { AdminFooter, AdminHeader } from '@/components/portal/admin-header';

interface AdminOrder {
  id: string;
  order_code: string;
  status: string;
  total: number;
  created_at: string;
  restaurant_name: string;
  customer_name: string;
}

/** แท็บกลุ่มสถานะ — ตรงกับตัวกรอง group ฝั่ง API */
const TABS: { key: string; label: string }[] = [
  { key: '', label: 'ทั้งหมด' },
  { key: 'active', label: 'กำลังดำเนินการ' },
  { key: 'done', label: 'เสร็จสิ้น' },
  { key: 'cancelled', label: 'ยกเลิก' },
];

/** ช่วงวันที่ (เวลาไทย) */
function thaiRange(range: string): { from: string | null; to: string | null } {
  if (range === 'all') return { from: null, to: null };
  const now = new Date(Date.now() + 7 * 3600_000);
  const d = (offsetDays: number) => {
    const x = new Date(now);
    x.setUTCDate(x.getUTCDate() + offsetDays);
    return x.toISOString().slice(0, 10);
  };
  if (range === 'today') return { from: d(0), to: d(0) };
  if (range === '7d') return { from: d(-6), to: d(0) };
  return { from: d(-29), to: d(0) };
}

/** หน้าออเดอร์ทั้งระบบ (แอดมิน) — กรองกลุ่ม/วันที่ + ค้นหารหัส */
export default function AdminOrdersPage() {
  const [tab, setTab] = useState('');
  const [range, setRange] = useState('7d');
  const [q, setQ] = useState('');
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tick, setTick] = useState(0);

  const load = useCallback(() => {
    const { from, to } = thaiRange(range);
    const p = new URLSearchParams({ limit: '200' });
    if (tab) p.set('group', tab);
    if (from) p.set('from', from);
    if (to) p.set('to', to);
    if (q.trim()) p.set('q', q.trim());
    setLoading(true);
    api<{ data: AdminOrder[] }>(`/api/admin/orders?${p.toString()}`)
      .then((r) => {
        setOrders(r.data);
        setError('');
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [tab, range, q, tick]);

  useEffect(() => {
    const t = setTimeout(load, q ? 300 : 0);
    return () => clearTimeout(t);
  }, [load]);

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <AdminHeader />

      <main className="mx-auto w-full max-w-6xl flex-1 space-y-6 px-4 py-5">
        {/* หัวข้อหน้า */}
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-lg font-bold text-black">ออเดอร์ทั้งหมด</h1>
          <button
            onClick={() => setTick((x) => x + 1)}
            className="flex items-center gap-1.5 rounded-full border border-line px-3 py-2 text-xs font-semibold text-neutral-600 transition-colors hover:bg-neutral-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} aria-hidden /> รีเฟรช
          </button>
        </div>

        {error && (
          <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </p>
        )}

        {/* ค้นหาด้วยรหัสออเดอร์ */}
        <label className="flex h-11 items-center gap-2 rounded-full border border-line bg-neutral-50 px-4">
          <Search className="h-4 w-4 shrink-0 text-neutral-400" aria-hidden />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="ค้นหารหัสออเดอร์ เช่น FT-2609"
            aria-label="ค้นหารหัสออเดอร์"
            className="w-full bg-transparent text-sm text-black outline-none placeholder:text-neutral-400"
          />
        </label>

        {/* แท็บกลุ่มสถานะ */}
        <div role="tablist" aria-label="กรองตามกลุ่มสถานะ" className="flex gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {TABS.map((t) => (
            <button
              key={t.key || 'all'}
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => setTab(t.key)}
              className={`flex h-9 shrink-0 items-center rounded-full px-3.5 text-xs font-bold transition-colors ${
                tab === t.key ? 'bg-[#FFC400] text-black' : 'bg-neutral-100 text-neutral-600 hover:bg-[#FFF4CC]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ช่วงวันที่ */}
        <div role="radiogroup" aria-label="ช่วงวันที่" className="flex gap-1.5">
          {[
            { k: 'today', l: 'วันนี้' },
            { k: '7d', l: '7 วัน' },
            { k: '30d', l: '30 วัน' },
            { k: 'all', l: 'ทั้งหมด' },
          ].map((r) => (
            <button
              key={r.k}
              role="radio"
              aria-checked={range === r.k}
              onClick={() => setRange(r.k)}
              className={`flex h-8 items-center rounded-full border px-3 text-[11px] font-bold transition-colors ${
                range === r.k ? 'border-[#FFC400] bg-[#FFF4CC] text-black' : 'border-line text-neutral-500 hover:bg-neutral-50'
              }`}
            >
              {r.l}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-3xl bg-neutral-100" />
            ))}
          </div>
        ) : orders.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-line px-4 py-10 text-center">
            <ClipboardList className="mx-auto h-8 w-8 text-neutral-300" aria-hidden />
            <p className="mt-2 text-sm text-neutral-400">ไม่พบออเดอร์ในเงื่อนไขนี้</p>
          </div>
        ) : (
          <ul className="overflow-hidden rounded-3xl border border-line bg-white">
            {orders.map((o, i) => (
              <li key={o.id} className={i > 0 ? 'border-t border-line' : ''}>
                <Link href={`/admin/orders/${o.id}`} className="flex flex-wrap items-center gap-2 px-4 py-3 transition-colors hover:bg-neutral-50">
                  <div className="min-w-0 flex-1 sm:flex-none sm:w-32">
                    <p className="truncate-1 font-mono text-xs font-bold text-black">#{o.order_code}</p>
                    <p className="flex items-center gap-1 text-[11px] text-neutral-400">
                      <Clock className="h-3 w-3" aria-hidden />
                      {new Date(o.created_at).toLocaleString('th-TH', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate-1 text-sm font-bold text-black">{o.restaurant_name}</p>
                    <p className="truncate-1 text-[11px] text-neutral-400">ลูกค้า: {o.customer_name}</p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${
                      o.status === 'paid'
                        ? 'bg-[#FFC400] text-black'
                        : ['delivered', 'completed'].includes(o.status)
                          ? 'bg-black text-white'
                          : ['cancelled', 'refunded'].includes(o.status)
                            ? 'bg-red-50 text-red-600'
                            : 'bg-neutral-100 text-neutral-700'
                    }`}
                  >
                    {STATUS_TH[o.status] ?? o.status}
                  </span>
                  <span className="w-20 shrink-0 text-right text-sm font-bold text-black">{baht(o.total)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>

      <AdminFooter />
    </div>
  );
}
