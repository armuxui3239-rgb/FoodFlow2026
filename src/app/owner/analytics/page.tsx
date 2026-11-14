'use client';

import { useEffect, useState } from 'react';
import { ClipboardList, PieChart, TrendingUp, Trophy } from 'lucide-react';
import { api, baht, STATUS_TH } from '@/lib/client';
import { OwnerSubShell } from '@/components/portal/owner-header';

interface Analytics {
  perDay: { date: string; orders: number; revenue: number }[];
  topItems: { name: string; quantity: number; revenue: number }[];
  statuses: { status: string; count: number }[];
}

/** หน้าวิเคราะห์ 30 วัน — กราฟรายวัน + เมนูทำรายได้สูงสุด + สถานะออเดอร์ */
export default function OwnerAnalyticsPage() {
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api<Analytics>('/api/owner/analytics')
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const maxRevenue = Math.max(1, ...(data?.perDay.map((d) => d.revenue) ?? [1]));
  const dayLabel = (iso: string) =>
    new Date(iso + 'T00:00:00+07:00').toLocaleDateString('th-TH', { day: 'numeric' });
  const totalOrders = data?.perDay.reduce((s, d) => s + d.orders, 0) ?? 0;
  const totalRevenue = data?.perDay.reduce((s, d) => s + d.revenue, 0) ?? 0;
  const statusMax = Math.max(1, ...(data?.statuses.map((s) => s.count) ?? [1]));

  return (
    <OwnerSubShell title="วิเคราะห์ 30 วัน" subtitle="ยอดขาย เมนูขายดี และสถานะออเดอร์" Icon={TrendingUp}>
      {error && (
        <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </p>
      )}

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-3xl bg-neutral-100" />
          ))}
        </div>
      ) : data && (
        <>
          {/* ยอดรวม 30 วัน */}
          <section className="grid grid-cols-2 gap-3" aria-label="ยอดรวม 30 วัน">
            <div className="rounded-3xl border border-line bg-white p-4">
              <ClipboardList className="h-5 w-5 text-black" aria-hidden />
              <p className="mt-2 text-2xl font-bold text-black">{totalOrders}</p>
              <p className="text-xs text-neutral-500">ออเดอร์สำเร็จ 30 วัน</p>
            </div>
            <div className="rounded-3xl border border-line bg-white p-4">
              <TrendingUp className="h-5 w-5 text-black" aria-hidden />
              <p className="mt-2 text-2xl font-bold text-black">{baht(totalRevenue)}</p>
              <p className="text-xs text-neutral-500">ยอดขายรวม 30 วัน</p>
            </div>
          </section>

          {/* กราฟแท่งรายวัน (CSS จริง ไม่ใช้รูป) */}
          <section className="rounded-3xl border border-line p-4" aria-label="กราฟยอดขายรายวัน">
            <h2 className="mb-3 text-sm font-bold text-black">ยอดขายรายวัน (30 วัน)</h2>
            <div className="flex h-40 items-end gap-1">
              {data.perDay.map((d, i) => (
                <div key={d.date} className="flex min-w-0 flex-1 flex-col items-center gap-1">
                  <span className="text-[9px] font-bold text-neutral-500">{d.revenue > 0 ? baht(d.revenue) : ''}</span>
                  <div
                    className={`w-full max-w-6 rounded-t-xl ${d.revenue > 0 ? 'bg-[#FFC400]' : 'bg-neutral-100'}`}
                    style={{ height: `${Math.max(4, (d.revenue / maxRevenue) * 120)}px` }}
                    role="img"
                    aria-label={`${d.date} ${baht(d.revenue)} ${d.orders} ออเดอร์`}
                  />
                  <span className="text-[9px] text-neutral-400">{i % 5 === 4 || i === data.perDay.length - 1 ? dayLabel(d.date) : ''}</span>
                </div>
              ))}
            </div>
          </section>

          {/* เมนูทำรายได้สูงสุด 10 อันดับ */}
          <section className="rounded-3xl border border-line p-4" aria-label="เมนูทำรายได้สูงสุด">
            <h2 className="mb-2 flex items-center gap-1.5 text-sm font-bold text-black">
              <Trophy className="h-4 w-4" aria-hidden /> เมนูทำรายได้สูงสุด
            </h2>
            {data.topItems.length === 0 ? (
              <p className="py-4 text-center text-sm text-neutral-300">ยังไม่มีข้อมูล — จะแสดงเมื่อมีออเดอร์สำเร็จ</p>
            ) : (
              <ol className="space-y-2">
                {data.topItems.map((it, i) => (
                  <li key={it.name} className="flex items-center gap-3">
                    <span
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                        i === 0 ? 'bg-[#FFC400] text-black' : 'bg-neutral-100 text-neutral-500'
                      }`}
                    >
                      {i + 1}
                    </span>
                    <span className="min-w-0 flex-1 truncate-1 text-sm text-black">{it.name}</span>
                    <span className="shrink-0 text-xs text-neutral-400">{it.quantity} จาน</span>
                    <span className="shrink-0 text-xs font-bold text-black">{baht(it.revenue)}</span>
                  </li>
                ))}
              </ol>
            )}
          </section>

          {/* การกระจายสถานะออเดอร์ */}
          <section className="rounded-3xl border border-line p-4" aria-label="สถานะออเดอร์ 30 วัน">
            <h2 className="mb-3 flex items-center gap-1.5 text-sm font-bold text-black">
              <PieChart className="h-4 w-4" aria-hidden /> สถานะออเดอร์ 30 วัน
            </h2>
            {data.statuses.length === 0 ? (
              <p className="py-4 text-center text-sm text-neutral-300">ยังไม่มีออเดอร์ในช่วงนี้</p>
            ) : (
              <ul className="space-y-3">
                {data.statuses.map((s) => (
                  <li key={s.status}>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="font-semibold text-neutral-600">{STATUS_TH[s.status] ?? s.status}</span>
                      <span className="font-bold text-black">{s.count} ใบ</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-100">
                      <div className="h-full rounded-full bg-[#FFC400]" style={{ width: `${(s.count / statusMax) * 100}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </OwnerSubShell>
  );
}
