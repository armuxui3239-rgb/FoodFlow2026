'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Bike, CheckCircle2 } from 'lucide-react';
import { api, baht } from '@/lib/client';

interface HistoryRow {
  id: string;
  orderCode: string;
  deliveryFee: number;
  restaurantName: string;
  deliveredAt: string | null;
  distanceKm: number | null;
}

/** หน้าประวัติงานไรเดอร์ — งานที่ส่งสำเร็จจริงจาก delivery_tasks */
export default function DriverHistoryPage() {
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api<{ data: HistoryRow[] }>('/api/driver/history')
      .then((d) => setRows(d.data))
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
            <Bike className="h-5 w-5" aria-hidden />
          </span>
          <h1 className="text-sm font-bold text-black">ประวัติงานส่งสำเร็จ</h1>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 space-y-3 px-4 py-5">
        {error && <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-3xl bg-neutral-100" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <p className="rounded-3xl border border-dashed border-line px-4 py-10 text-center text-sm text-neutral-300">
            ยังไม่มีงานที่ส่งสำเร็จ — เริ่มรับงานแรกได้ที่หน้าหลัก
          </p>
        ) : (
          <ul className="overflow-hidden rounded-3xl border border-line bg-white">
            {rows.map((r, i) => (
              <li key={r.id} className={`flex items-center gap-3 px-4 py-3 ${i > 0 ? 'border-t border-line' : ''}`}>
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#FFF4CC]">
                  <CheckCircle2 className="h-5 w-5 text-black" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate-1 text-sm font-bold text-black">#{r.orderCode} · {r.restaurantName}</p>
                  <p className="text-[11px] text-neutral-400">
                    {r.deliveredAt
                      ? new Date(r.deliveredAt).toLocaleString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
                      : '-'}
                    {r.distanceKm ? ` · ${Number(r.distanceKm).toFixed(1)} กม.` : ''}
                  </p>
                </div>
                <span className="shrink-0 text-sm font-bold text-black">+{baht(r.deliveryFee)}</span>
              </li>
            ))}
          </ul>
        )}
      </main>

      <footer className="mt-auto border-t border-line bg-white pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-4 text-center text-xs text-neutral-400">
        © {new Date().getFullYear()} ฟู๊ด ธันเดอร์ — พอร์ทัลไรเดอร์
      </footer>
    </div>
  );
}
