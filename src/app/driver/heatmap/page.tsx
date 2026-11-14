'use client';

import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Flame, LogIn, RefreshCw, Store } from 'lucide-react';
import { api, useSession } from '@/lib/client';

// โหลด maplibre เฉพาะเบราว์เซอร์ — กัน SSR compile กินหน่วยความจำจนเซิร์ฟเวอร์ OOM
const HeatmapCanvas = dynamic(() => import('./HeatmapCanvas'), {
  ssr: false,
  loading: () => <div className="flex h-full items-center justify-center text-sm text-neutral-400">กำลังโหลดแผนที่…</div>,
});

interface HeatItem {
  restaurantId: string;
  name: string;
  lat: number;
  lng: number;
  orderCount: number;
}

/** สีตามความต้องการ: 0 ออเดอร์ = เทา, 1–5 = เหลือง, 6 ขึ้นไป = แดง */
function demandColor(orderCount: number): string {
  if (orderCount >= 6) return '#EF4444';
  if (orderCount >= 1) return '#FFC400';
  return '#9CA3AF';
}

/** หน้าแผนที่ความต้องการจัดส่ง — จำนวนออเดอร์สำเร็จต่อร้าน 7 วันล่าสุด (เฉพาะไรเดอร์) */
export default function DriverHeatmapPage() {
  const { user, ready: sessionReady } = useSession();
  const [items, setItems] = useState<HeatItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api<HeatItem[]>('/api/driver/heatmap')
      .then((d) => {
        setItems(d);
        setError('');
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!sessionReady || !user || user.role !== 'driver') return;
    load();
  }, [user, sessionReady, load]);

  if (!sessionReady) {
    return (
      <div className="space-y-3 py-2" aria-busy="true" aria-label="กำลังโหลด">
        <div className="h-[50vh] animate-pulse rounded-3xl bg-neutral-100" />
      </div>
    );
  }

  if (!user || user.role !== 'driver') {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-neutral-100">
          <Flame className="h-8 w-8 text-neutral-300" aria-hidden />
        </span>
        <p className="text-sm text-neutral-500">เฉพาะไรเดอร์เท่านั้น</p>
        <Link href="/login?next=%2Fdriver%2Fheatmap" className="btn-brand inline-flex h-11 items-center gap-2 rounded-full px-6 text-sm">
          <LogIn className="h-4 w-4" aria-hidden /> เข้าสู่ระบบด้วยบัญชีไรเดอร์
        </Link>
      </div>
    );
  }

  const points = items.map((d) => ({
    lng: d.lng,
    lat: d.lat,
    name: d.name,
    orderCount: d.orderCount,
    color: demandColor(d.orderCount),
  }));
  const top10 = items.slice(0, 10);

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <header className="sticky top-0 z-40 border-b border-line bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-2 px-4">
          <Link
            href="/driver"
            aria-label="ย้อนกลับไปพอร์ทัลไรเดอร์"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-neutral-100 transition-transform active:scale-95"
          >
            <ArrowLeft className="h-5 w-5" aria-hidden />
          </Link>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#FFC400] text-black">
            <Flame className="h-5 w-5" aria-hidden />
          </span>
          <h1 className="min-w-0 flex-1 truncate-1 text-sm font-bold text-black">แผนที่ความต้องการ</h1>
          <button
            onClick={() => void load()}
            aria-label="รีเฟรช"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full hover:bg-neutral-100"
          >
            <RefreshCw className={`h-5 w-5 text-neutral-500 ${loading ? 'animate-spin' : ''}`} aria-hidden />
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 space-y-4 px-4 py-5">
        <p className="text-xs text-neutral-400">จำนวนออเดอร์ที่ส่งสำเร็จต่อร้านใน 7 วันล่าสุด — เลือกโซนที่หมุดร้อนแรงเพื่อรอรับงาน</p>

        {error && <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}

        {loading ? (
          <div className="h-[50vh] animate-pulse rounded-3xl bg-neutral-100" />
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-line px-4 py-14 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-neutral-100">
              <Flame className="h-7 w-7 text-neutral-300" aria-hidden />
            </span>
            <p className="text-sm font-bold text-black">ยังไม่มีข้อมูลความต้องการ</p>
            <p className="text-xs text-neutral-400">ยังไม่มีร้านที่มีพิกัดหรือออเดอร์ในพื้นที่ให้บริการ ลองกลับมาดูใหม่ภายหลัง</p>
          </div>
        ) : (
          <>
            {/* ผืนแผนที่ */}
            <div className="relative h-[50vh] overflow-hidden rounded-3xl border border-line">
              <HeatmapCanvas points={points} />
            </div>

            {/* คำอธิบายสี */}
            <section aria-label="คำอธิบายสีความต้องการ" className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-3xl border border-line bg-white px-4 py-3">
              <span className="text-xs font-bold text-black">ระดับความต้องการ</span>
              {[
                { label: 'น้อย (0 ออเดอร์)', color: demandColor(0) },
                { label: 'ปานกลาง (1–5)', color: demandColor(3) },
                { label: 'สูง (6+)', color: demandColor(6) },
              ].map(({ label, color }) => (
                <span key={label} className="flex items-center gap-2 text-xs text-neutral-600">
                  <span className="h-3.5 w-3.5 rounded-full border-2 border-white shadow-sm" style={{ backgroundColor: color }} aria-hidden />
                  {label}
                </span>
              ))}
            </section>

            {/* ร้านอันดับต้น */}
            <section aria-label="ร้านที่มีความต้องการสูงสุด">
              <h2 className="mb-2 text-sm font-bold text-black">ร้านที่มีออเดอร์มากที่สุด (10 อันดับ)</h2>
              <ul className="overflow-hidden rounded-3xl border border-line bg-white">
                {top10.map((r, i) => (
                  <li key={r.restaurantId} className={`flex items-center gap-3 px-4 py-3 ${i > 0 ? 'border-t border-line' : ''}`}>
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-xs font-bold text-neutral-500">
                      {i + 1}
                    </span>
                    <Store className="h-4.5 w-4.5 shrink-0 text-black" aria-hidden />
                    <p className="min-w-0 flex-1 truncate-1 text-sm text-black">{r.name}</p>
                    <span
                      className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold text-black"
                      style={{ backgroundColor: demandColor(r.orderCount) }}
                    >
                      {r.orderCount} ออเดอร์
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          </>
        )}
      </main>

      <footer className="mt-auto border-t border-line bg-white pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-4 text-center text-xs text-neutral-400">
        © {new Date().getFullYear()} ฟู๊ด ธันเดอร์ — พอร์ทัลไรเดอร์
      </footer>
    </div>
  );
}
