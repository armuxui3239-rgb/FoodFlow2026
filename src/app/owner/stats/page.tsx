'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Receipt, Store, TrendingUp } from 'lucide-react';
import { api, baht } from '@/lib/client';

interface Stats {
  days: { date: string; revenue: number; count: number }[];
  totalRevenueSatang: number;
  totalOrders: number;
  topItems: { name: string; qty: number }[];
}

/** หน้าสถิติร้าน — ยอดขาย 7 วัน (จากออเดอร์ delivered/completed จริง) + เมนูขายดี */
export default function OwnerStatsPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api<Stats>('/api/owner/stats')
      .then(setStats)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  const maxRevenue = Math.max(1, ...(stats?.days.map((d) => d.revenue) ?? [1]));
  const dayLabel = (iso: string) =>
    new Date(iso + 'T00:00:00+07:00').toLocaleDateString('th-TH', { weekday: 'short', day: 'numeric' });

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
            <TrendingUp className="h-5 w-5" aria-hidden />
          </span>
          <h1 className="text-sm font-bold text-black">สถิติยอดขาย 7 วัน</h1>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 space-y-5 px-4 py-5">
        {error && <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-24 animate-pulse rounded-3xl bg-neutral-100" />
            ))}
          </div>
        ) : stats && (
          <>
            {/* ยอดรวม 7 วัน */}
            <section className="grid grid-cols-2 gap-3" aria-label="ยอดรวม 7 วัน">
              <div className="rounded-3xl border border-line bg-white p-4">
                <Receipt className="h-5 w-5 text-black" aria-hidden />
                <p className="mt-2 text-2xl font-bold text-black">{baht(stats.totalRevenueSatang)}</p>
                <p className="text-xs text-neutral-500">ยอดขาย 7 วัน</p>
              </div>
              <div className="rounded-3xl border border-line bg-white p-4">
                <Store className="h-5 w-5 text-black" aria-hidden />
                <p className="mt-2 text-2xl font-bold text-black">{stats.totalOrders}</p>
                <p className="text-xs text-neutral-500">ออเดอร์สำเร็จ 7 วัน</p>
              </div>
            </section>

            {/* กราฟแท่งรายวัน (CSS จริง ไม่ใช้รูป) */}
            <section className="rounded-3xl border border-line p-4" aria-label="กราฟยอดขายรายวัน">
              <h2 className="mb-3 text-sm font-bold text-black">ยอดขายรายวัน</h2>
              <div className="flex h-40 items-end gap-2">
                {stats.days.map((d) => (
                  <div key={d.date} className="flex min-w-0 flex-1 flex-col items-center gap-1">
                    <span className="text-[10px] font-bold text-neutral-500">{d.revenue > 0 ? baht(d.revenue) : ''}</span>
                    <div
                      className={`w-full max-w-10 rounded-t-xl ${d.revenue > 0 ? 'bg-[#FFC400]' : 'bg-neutral-100'}`}
                      style={{ height: `${Math.max(4, (d.revenue / maxRevenue) * 120)}px` }}
                      role="img"
                      aria-label={`${dayLabel(d.date)} ${baht(d.revenue)} ${d.count} ออเดอร์`}
                    />
                    <span className="text-[10px] text-neutral-400">{dayLabel(d.date)}</span>
                    <span className="text-[10px] font-semibold text-neutral-500">{d.count > 0 ? `${d.count} ใบ` : ''}</span>
                  </div>
                ))}
              </div>
            </section>

            {/* เมนูขายดี */}
            <section className="rounded-3xl border border-line p-4" aria-label="เมนูขายดี">
              <h2 className="mb-2 text-sm font-bold text-black">เมนูขายดี (7 วัน)</h2>
              {stats.topItems.length === 0 ? (
                <p className="py-4 text-center text-sm text-neutral-300">ยังไม่มีข้อมูล — จะแสดงเมื่อมีออเดอร์สำเร็จ</p>
              ) : (
                <ol className="space-y-2">
                  {stats.topItems.map((it, i) => (
                    <li key={it.name} className="flex items-center gap-3">
                      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${i === 0 ? 'bg-[#FFC400] text-black' : 'bg-neutral-100 text-neutral-500'}`}>
                        {i + 1}
                      </span>
                      <span className="min-w-0 flex-1 truncate-1 text-sm text-black">{it.name}</span>
                      <span className="shrink-0 text-xs font-bold text-neutral-500">{it.qty} จาน</span>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </>
        )}
      </main>

      <footer className="mt-auto border-t border-line bg-white pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-4 text-center text-xs text-neutral-400">
        © {new Date().getFullYear()} ฟู๊ด ธันเดอร์ — พอร์ทัลร้านค้า
      </footer>
    </div>
  );
}
