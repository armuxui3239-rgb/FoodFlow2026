'use client';

import { useCallback, useEffect, useState } from 'react';
import { BarChart3, Bike, RefreshCw, Store, Wallet } from 'lucide-react';
import { api, baht, STATUS_TH } from '@/lib/client';
import { AdminFooter, AdminHeader } from '@/components/portal/admin-header';

interface TopRestaurant {
  id: string;
  name: string;
  revenue: number;
  orders: number;
}

interface TopDriver {
  id: string;
  name: string;
  deliveries: number;
}

interface AnalyticsData {
  statusDist: Record<string, number>;
  topRestaurants: TopRestaurant[];
  topDrivers: TopDriver[];
  totals: { orders: number; gmv: number; avgOrderValue: number; delivered: number };
}

/** แถบแนวนอนแบบ CSS — ใช้ซ้ำสำหรับ top ร้าน/ไรเดอร์/สถานะ */
function BarRow({ label, sub, value, max, valueText }: { label: string; sub?: string; value: number; max: number; valueText: string }) {
  return (
    <li>
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <p className="min-w-0 truncate-1 font-semibold text-black">
          {label}
          {sub && <span className="ml-1.5 font-normal text-neutral-400">{sub}</span>}
        </p>
        <span className="shrink-0 font-bold text-black">{valueText}</span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-neutral-100" role="presentation">
        <div className="h-full rounded-full bg-[#FFC400]" style={{ width: max > 0 ? `${Math.max(3, (value / max) * 100)}%` : '0%' }} />
      </div>
    </li>
  );
}

/** หน้าวิเคราะห์ — กระจายสถานะ + ร้าน/ไรเดอร์ top 5 + ยอดเฉลี่ยต่อบิล */
export default function AdminAnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tick, setTick] = useState(0);

  const load = useCallback(() => {
    setLoading(true);
    api<AnalyticsData>('/api/admin/analytics')
      .then((r) => {
        setData(r);
        setError('');
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const t = setTimeout(load, 0); // หน่วงออกจาก effect body กัน cascading render
    return () => clearTimeout(t);
  }, [load, tick]);

  const statusEntries = data ? Object.entries(data.statusDist).sort((a, b) => b[1] - a[1]) : [];
  const maxStatus = statusEntries[0]?.[1] ?? 0;
  const maxRevenue = data?.topRestaurants[0]?.revenue ?? 0;
  const maxDeliveries = data?.topDrivers[0]?.deliveries ?? 0;

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <AdminHeader />

      <main className="mx-auto w-full max-w-5xl flex-1 space-y-5 px-4 py-5">
        <div className="flex items-center justify-between gap-2">
          <h1 className="flex items-center gap-2 text-lg font-bold text-black">
            <BarChart3 className="h-5 w-5" aria-hidden /> วิเคราะห์ข้อมูล
          </h1>
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

        {loading ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-24 animate-pulse rounded-3xl bg-neutral-100" />
              ))}
            </div>
            <div className="h-64 animate-pulse rounded-3xl bg-neutral-100" />
          </div>
        ) : !data ? (
          <div className="rounded-3xl border border-dashed border-line px-4 py-10 text-center">
            <BarChart3 className="mx-auto h-8 w-8 text-neutral-300" aria-hidden />
            <p className="mt-2 text-sm text-neutral-400">ยังไม่มีข้อมูลวิเคราะห์</p>
          </div>
        ) : (
          <>
            {/* การ์ดสรุป */}
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-3xl border border-line bg-white p-4 shadow-sm">
                <p className="flex items-center gap-1.5 text-[11px] font-semibold text-neutral-400">
                  <BarChart3 className="h-3.5 w-3.5" aria-hidden /> ออเดอร์ทั้งหมด
                </p>
                <p className="mt-1 text-xl font-bold text-black">{data.totals.orders}</p>
              </div>
              <div className="rounded-3xl border border-line bg-white p-4 shadow-sm">
                <p className="flex items-center gap-1.5 text-[11px] font-semibold text-neutral-400">
                  <Wallet className="h-3.5 w-3.5" aria-hidden /> ยอดเฉลี่ยต่อบิล
                </p>
                <p className="mt-1 text-xl font-bold text-black">{baht(data.totals.avgOrderValue)}</p>
              </div>
              <div className="rounded-3xl border border-line bg-white p-4 shadow-sm">
                <p className="text-[11px] font-semibold text-neutral-400">ส่งสำเร็จ</p>
                <p className="mt-1 text-xl font-bold text-black">{data.totals.delivered}</p>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              {/* ร้าน top 5 */}
              <section aria-label="ร้านค้ายอดนิยม" className="rounded-3xl border border-line bg-white p-4 shadow-sm">
                <h2 className="flex items-center gap-1.5 text-sm font-bold text-black">
                  <Store className="h-4 w-4" aria-hidden /> ร้านค้ายอดนิยม (5 อันดับ)
                </h2>
                {data.topRestaurants.length === 0 ? (
                  <p className="mt-4 text-sm text-neutral-400">ยังไม่มีออเดอร์ที่ส่งสำเร็จ</p>
                ) : (
                  <ul className="mt-3 space-y-3">
                    {data.topRestaurants.map((r) => (
                      <BarRow key={r.id} label={r.name} sub={`${r.orders} ออเดอร์`} value={r.revenue} max={maxRevenue} valueText={baht(r.revenue)} />
                    ))}
                  </ul>
                )}
              </section>

              {/* ไรเดอร์ top 5 */}
              <section aria-label="ไรเดอร์ยอดนิยม" className="rounded-3xl border border-line bg-white p-4 shadow-sm">
                <h2 className="flex items-center gap-1.5 text-sm font-bold text-black">
                  <Bike className="h-4 w-4" aria-hidden /> ไรเดอร์ส่งมากสุด (5 อันดับ)
                </h2>
                {data.topDrivers.length === 0 ? (
                  <p className="mt-4 text-sm text-neutral-400">ยังไม่มีงานส่งที่สำเร็จ</p>
                ) : (
                  <ul className="mt-3 space-y-3">
                    {data.topDrivers.map((d) => (
                      <BarRow key={d.id} label={d.name} value={d.deliveries} max={maxDeliveries} valueText={`${d.deliveries} งาน`} />
                    ))}
                  </ul>
                )}
              </section>
            </div>

            {/* กระจายสถานะ */}
            <section aria-label="กระจายตามสถานะออเดอร์" className="rounded-3xl border border-line bg-white p-4 shadow-sm">
              <h2 className="text-sm font-bold text-black">ออเดอร์ตามสถานะ</h2>
              {statusEntries.length === 0 ? (
                <p className="mt-4 text-sm text-neutral-400">ยังไม่มีออเดอร์ในระบบ</p>
              ) : (
                <ul className="mt-3 space-y-3">
                  {statusEntries.map(([status, count]) => (
                    <BarRow key={status} label={STATUS_TH[status] ?? status} value={count} max={maxStatus} valueText={`${count}`} />
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </main>

      <AdminFooter />
    </div>
  );
}
