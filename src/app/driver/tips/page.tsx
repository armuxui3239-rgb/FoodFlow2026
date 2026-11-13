'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, HeartHandshake } from 'lucide-react';
import { api, baht } from '@/lib/client';

interface TipRow {
  id: string;
  orderCode: string;
  amountSatang: number;
  status: string;
  createdAt: string;
}

/** หน้าทิปของไรเดอร์ — ข้อมูลจริงจาก driver_tip_reports */
export default function DriverTipsPage() {
  const [rows, setRows] = useState<TipRow[]>([]);
  const [totalSatang, setTotalSatang] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api<{ totalSatang: number; data: TipRow[] }>('/api/driver/tips')
      .then((d) => {
        setRows(d.data);
        setTotalSatang(d.totalSatang);
        setError('');
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <header className="sticky top-0 z-40 border-b border-line bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-2 px-4">
          <Link
            href="/driver"
            aria-label="ย้อนกลับ"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-neutral-100 transition-transform active:scale-95"
          >
            <ArrowLeft className="h-5 w-5" aria-hidden />
          </Link>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#FFC400] text-black">
            <HeartHandshake className="h-5 w-5" aria-hidden />
          </span>
          <h1 className="text-sm font-bold text-black">ทิปจากลูกค้า</h1>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 space-y-4 px-4 py-5">
        {error && <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}

        <section aria-label="ทิปรวม" className="rounded-3xl bg-black p-6 text-white">
          <p className="flex items-center gap-2 text-sm text-[#FFC400]">
            <HeartHandshake className="h-5 w-5" aria-hidden /> ทิปที่ได้รับทั้งหมด
          </p>
          {loading ? (
            <div className="mt-2 h-10 w-28 animate-pulse rounded-2xl bg-neutral-800" />
          ) : (
            <p className="mt-1 text-5xl font-bold text-[#FFC400]">{baht(totalSatang)}</p>
          )}
          <p className="mt-2 text-xs text-white/60">โอนเข้าบัญชีค่าเริ่มต้นพร้อมรายได้ค่าส่ง</p>
        </section>

        <section aria-label="ประวัติทิป">
          <h2 className="mb-2 text-sm font-bold text-black">ประวัติล่าสุด</h2>
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-14 animate-pulse rounded-2xl bg-neutral-100" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <p className="rounded-3xl border border-dashed border-line px-4 py-10 text-center text-sm text-neutral-300">
              ยังไม่มีทิป — ลูกค้าสามารถทิปได้หลังคุณส่งอาหารถึงมือ
            </p>
          ) : (
            <ul className="overflow-hidden rounded-3xl border border-line bg-white">
              {rows.map((r, i) => (
                <li key={r.id} className={`flex items-center gap-3 px-4 py-3 ${i > 0 ? 'border-t border-line' : ''}`}>
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#FFF4CC]">
                    <HeartHandshake className="h-4.5 w-4.5 text-black" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate-1 text-sm font-bold text-black">#{r.orderCode}</p>
                    <p className="text-[11px] text-neutral-400">
                      {new Date(r.createdAt).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}
                      {' · '}
                      {r.status === 'completed' ? 'โอนแล้ว' : r.status === 'pending' ? 'รอโอน' : r.status}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-bold text-black">+{baht(r.amountSatang)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>

      <footer className="mt-auto border-t border-line bg-white pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-4 text-center text-xs text-neutral-400">
        © {new Date().getFullYear()} ฟู๊ด ธันเดอร์ — พอร์ทัลไรเดอร์
      </footer>
    </div>
  );
}
