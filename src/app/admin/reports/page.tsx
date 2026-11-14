'use client';

import { useCallback, useEffect, useState } from 'react';
import { Download, FileBarChart, RefreshCw, Users, Store, Ban, Wallet, Receipt, Percent } from 'lucide-react';
import { api, baht } from '@/lib/client';
import { AdminFooter, AdminHeader } from '@/components/portal/admin-header';

interface PerDay {
  date: string;
  orders: number;
  gmv: number;
}

interface ReportData {
  days: number;
  totals: {
    count: number;
    gmv: number;
    commission: number;
    cancelled: number;
    newUsers: number;
    newRestaurants: number;
  };
  perDay: PerDay[];
}

/** หน้ารายงานภาพรวม — เลือกช่วงวัน การ์ดสรุป + กราฟแท่งรายวัน + ดาวน์โหลด CSV */
export default function AdminReportsPage() {
  const [days, setDays] = useState(30);
  const [reload, setReload] = useState(0);
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    api<ReportData>(`/api/admin/reports?days=${days}`)
      .then((r) => {
        setData(r);
        setError('');
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [days]);

  useEffect(() => {
    const t = setTimeout(load, 0); // หน่วงออกจาก effect body กัน cascading render
    return () => clearTimeout(t);
  }, [load, reload]);

  const maxGmv = data?.perDay.reduce((m, d) => Math.max(m, d.gmv), 0) ?? 0;

  /** ดาวน์โหลด CSV (BOM กันภาษาไทยเพี้ยนใน Excel) */
  const downloadCsv = () => {
    if (!data) return;
    const rows = [['วันที่', 'ออเดอร์', 'ยอดขาย'] as string[]];
    for (const d of data.perDay) rows.push([d.date, String(d.orders), String(d.gmv / 100)]);
    const csv = '\uFEFF' + rows.map((r) => r.join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `foodthunder-report-${data.days}d.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const cards = data
    ? [
        { label: 'ออเดอร์ในช่วง', value: String(data.totals.count), Icon: Receipt },
        { label: 'ยอดขาย (GMV)', value: baht(data.totals.gmv), Icon: Wallet },
        { label: 'ค่าคอมมิชชัน', value: baht(data.totals.commission), Icon: Percent },
        { label: 'ยกเลิก', value: String(data.totals.cancelled), Icon: Ban },
        { label: 'ผู้ใช้ใหม่', value: String(data.totals.newUsers), Icon: Users },
        { label: 'ร้านใหม่', value: String(data.totals.newRestaurants), Icon: Store },
      ]
    : [];

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <AdminHeader />

      <main className="mx-auto w-full max-w-6xl flex-1 space-y-5 px-4 py-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="flex items-center gap-2 text-lg font-bold text-black">
            <FileBarChart className="h-5 w-5" aria-hidden /> รายงานภาพรวม
          </h1>
          <div className="flex gap-1.5">
            <button
              onClick={() => setDays(7)}
              aria-pressed={days === 7}
              className={`flex h-9 items-center rounded-full border px-3 text-xs font-bold transition-colors ${
                days === 7 ? 'border-[#FFC400] bg-[#FFF4CC] text-black' : 'border-line text-neutral-500 hover:bg-neutral-50'
              }`}
            >
              7 วัน
            </button>
            <button
              onClick={() => setDays(30)}
              aria-pressed={days === 30}
              className={`flex h-9 items-center rounded-full border px-3 text-xs font-bold transition-colors ${
                days === 30 ? 'border-[#FFC400] bg-[#FFF4CC] text-black' : 'border-line text-neutral-500 hover:bg-neutral-50'
              }`}
            >
              30 วัน
            </button>
            <button
              onClick={() => setDays(90)}
              aria-pressed={days === 90}
              className={`flex h-9 items-center rounded-full border px-3 text-xs font-bold transition-colors ${
                days === 90 ? 'border-[#FFC400] bg-[#FFF4CC] text-black' : 'border-line text-neutral-500 hover:bg-neutral-50'
              }`}
            >
              90 วัน
            </button>
            <button
              onClick={() => setReload((r) => r + 1)}
              className="flex h-9 items-center gap-1.5 rounded-full border border-line px-3 text-xs font-semibold text-neutral-600 transition-colors hover:bg-neutral-50"
              aria-label="รีเฟรชรายงาน"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} aria-hidden /> รีเฟรช
            </button>
          </div>
        </div>

        {error && (
          <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </p>
        )}

        {loading ? (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-24 animate-pulse rounded-3xl bg-neutral-100" />
              ))}
            </div>
            <div className="h-64 animate-pulse rounded-3xl bg-neutral-100" />
          </>
        ) : !data ? (
          <div className="rounded-3xl border border-dashed border-line px-4 py-10 text-center">
            <FileBarChart className="mx-auto h-8 w-8 text-neutral-300" aria-hidden />
            <p className="mt-2 text-sm text-neutral-400">ไม่พบข้อมูลรายงาน</p>
          </div>
        ) : (
          <>
            {/* การ์ดสรุป */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {cards.map((c) => (
                <div key={c.label} className="rounded-3xl border border-line bg-white p-4 shadow-sm">
                  <p className="flex items-center gap-1.5 text-[11px] font-semibold text-neutral-400">
                    <c.Icon className="h-3.5 w-3.5" aria-hidden /> {c.label}
                  </p>
                  <p className="mt-1 text-xl font-bold text-black">{c.value}</p>
                </div>
              ))}
            </div>

            {/* กราฟแท่งยอดขายรายวัน (CSS) */}
            <section aria-label="ยอดขายรายวัน" className="rounded-3xl border border-line bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-bold text-black">ยอดขายรายวัน ({data.days} วันล่าสุด)</h2>
                <button
                  onClick={downloadCsv}
                  className="flex h-9 items-center gap-1.5 rounded-full bg-black px-3 text-xs font-bold text-white transition-transform active:scale-95"
                >
                  <Download className="h-3.5 w-3.5" aria-hidden /> CSV
                </button>
              </div>
              <div className="mt-4 flex h-48 items-end gap-[3px]" role="img" aria-label="กราฟแท่งยอดขายรายวัน">
                {data.perDay.map((d) => (
                  <div key={d.date} className="group relative flex h-full flex-1 items-end" title={`${d.date} · ${d.orders} ออเดอร์ · ${baht(d.gmv)}`}>
                    <div
                      className={`w-full rounded-t transition-colors group-hover:bg-black ${d.gmv > 0 ? 'bg-[#FFC400]' : 'bg-neutral-100'}`}
                      style={{ height: maxGmv > 0 ? `${Math.max(2, (d.gmv / maxGmv) * 100)}%` : '2%' }}
                    />
                  </div>
                ))}
              </div>
              <div className="mt-2 flex justify-between text-[10px] text-neutral-400">
                <span>{data.perDay[0]?.date}</span>
                <span>{data.perDay[data.perDay.length - 1]?.date}</span>
              </div>
            </section>
          </>
        )}
      </main>

      <AdminFooter />
    </div>
  );
}
