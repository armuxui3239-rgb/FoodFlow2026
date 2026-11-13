'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { ArrowLeft, CheckCircle2, ClipboardList, MapPin, Navigation, PackageCheck, Star } from 'lucide-react';
import { api, baht, STATUS_TH } from '@/lib/client';

interface TripDetail {
  task: {
    id: string;
    status: string;
    assignedAt: string | null;
    pickedUpAt: string | null;
    deliveredAt: string | null;
    distanceKm: number | null;
  };
  order: {
    code: string;
    status: string;
    deliveryFeeSatang: number;
    subtotalSatang: number;
    dropoffLabel: string | null;
    dropoffAddress: string | null;
    createdAt: string;
  };
  restaurant: { name: string; address: string | null };
  customerName: string;
  items: { name: string; quantity: number; unitPriceSatang: number }[];
  history: { id: string; status: string; created_at: string }[];
}

/** หน้ารายละเอียดงานส่ง — ข้อมูลจริงจาก /api/driver/trips/[id] */
export default function DriverTripPage() {
  const params = useParams<{ id: string }>();
  const tripId = params?.id ?? '';
  const [data, setData] = useState<TripDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    if (tripId === '') return;
    api<TripDetail>(`/api/driver/trips/${encodeURIComponent(tripId)}`)
      .then((d) => {
        setData(d);
        setError('');
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [tripId]);

  useEffect(load, [load]);

  const fmt = (iso: string | null) =>
    iso
      ? new Date(iso).toLocaleString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
      : '-';

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <header className="sticky top-0 z-40 border-b border-line bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-2 px-4">
          <Link
            href="/driver/history"
            aria-label="ย้อนกลับไปประวัติงาน"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-neutral-100 transition-transform active:scale-95"
          >
            <ArrowLeft className="h-5 w-5" aria-hidden />
          </Link>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#FFC400] text-black">
            <ClipboardList className="h-5 w-5" aria-hidden />
          </span>
          <h1 className="truncate-1 text-sm font-bold text-black">
            งานส่ง #{data?.order.code ?? params?.id?.slice(0, 8) ?? '...'}
          </h1>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 space-y-4 px-4 py-5">
        {error && <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}

        {loading ? (
          <div className="space-y-3">
            <div className="h-24 animate-pulse rounded-3xl bg-neutral-100" />
            <div className="h-40 animate-pulse rounded-3xl bg-neutral-100" />
          </div>
        ) : data ? (
          <>
            {/* สรุปงาน */}
            <section aria-label="สรุปงาน" className="rounded-3xl bg-black p-5 text-white">
              <div className="flex items-center justify-between gap-2">
                <span className="text-lg font-bold text-[#FFC400]">#{data.order.code}</span>
                <span className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-bold text-[#FFC400]">
                  {STATUS_TH[data.task.status] ?? data.task.status}
                </span>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                <div>
                  <p className="font-bold text-white">{data.task.distanceKm ? `${Number(data.task.distanceKm).toFixed(1)} กม.` : '-'}</p>
                  <p className="text-white/50">ระยะทาง</p>
                </div>
                <div>
                  <p className="font-bold text-white">{fmt(data.task.pickedUpAt)}</p>
                  <p className="text-white/50">รับของ</p>
                </div>
                <div>
                  <p className="font-bold text-white">{fmt(data.task.deliveredAt)}</p>
                  <p className="text-white/50">ส่งถึง</p>
                </div>
              </div>
            </section>

            {/* เส้นทาง */}
            <section aria-label="เส้นทาง" className="space-y-2 rounded-3xl border border-line bg-white p-4">
              <p className="flex items-start gap-2 text-sm text-neutral-700">
                <Navigation className="mt-0.5 h-4.5 w-4.5 shrink-0 text-black" aria-hidden />
                <span>
                  <b>รับที่ร้าน:</b> {data.restaurant.name}
                  {data.restaurant.address && <span className="block text-xs text-neutral-400">{data.restaurant.address}</span>}
                </span>
              </p>
              <p className="flex items-start gap-2 text-sm text-neutral-700">
                <MapPin className="mt-0.5 h-4.5 w-4.5 shrink-0 text-black" aria-hidden />
                <span>
                  <b>ส่งให้ {data.customerName}:</b>{' '}
                  {data.order.dropoffLabel ? `${data.order.dropoffLabel} · ` : ''}
                  {data.order.dropoffAddress ?? 'ไม่มีที่อยู่'}
                </span>
              </p>
            </section>

            {/* รายการอาหาร */}
            <section aria-label="รายการอาหาร" className="rounded-3xl border border-line bg-white">
              <h2 className="border-b border-line px-4 py-3 text-xs font-bold uppercase tracking-wide text-neutral-400">
                รายการอาหาร
              </h2>
              <ul>
                {data.items.map((it, i) => (
                  <li key={i} className={`flex items-center justify-between px-4 py-3 text-sm ${i > 0 ? 'border-t border-line' : ''}`}>
                    <span className="min-w-0 flex-1 truncate-1 text-black">
                      {it.quantity}× {it.name}
                    </span>
                    <span className="shrink-0 text-neutral-500">{baht(it.unitPriceSatang * it.quantity)}</span>
                  </li>
                ))}
              </ul>
              <div className="flex items-center justify-between border-t border-line px-4 py-3 text-sm">
                <span className="text-neutral-500">ค่าส่งของฉัน</span>
                <span className="font-bold text-black">+{baht(data.order.deliveryFeeSatang)}</span>
              </div>
            </section>

            {/* ประวัติสถานะ */}
            <section aria-label="ประวัติสถานะ" className="rounded-3xl border border-line bg-white">
              <h2 className="border-b border-line px-4 py-3 text-xs font-bold uppercase tracking-wide text-neutral-400">
                เส้นทางสถานะ
              </h2>
              <ul>
                {data.history.map((h, i) => (
                  <li key={h.id} className={`flex items-center gap-3 px-4 py-2.5 text-xs ${i > 0 ? 'border-t border-line' : ''}`}>
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-neutral-300" aria-hidden />
                    <span className="min-w-0 flex-1 truncate-1 font-medium text-neutral-700">{STATUS_TH[h.status] ?? h.status}</span>
                    <span className="shrink-0 text-neutral-400">{fmt(h.created_at)}</span>
                  </li>
                ))}
                {data.history.length === 0 && (
                  <li className="px-4 py-3 text-xs text-neutral-400">ยังไม่มีประวัติสถานะ</li>
                )}
              </ul>
            </section>

            <Link
              href="/driver/history"
              className="btn-brand flex h-12 w-full items-center justify-center gap-2 text-sm"
            >
              <PackageCheck className="h-4.5 w-4.5" aria-hidden /> กลับไปประวัติงานส่ง
            </Link>
          </>
        ) : (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <Star className="h-10 w-10 text-neutral-300" aria-hidden />
            <p className="text-sm text-neutral-400">ไม่พบงานส่งนี้</p>
          </div>
        )}
      </main>

      <footer className="mt-auto border-t border-line bg-white pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-4 text-center text-xs text-neutral-400">
        © {new Date().getFullYear()} ฟู๊ด ธันเดอร์ — พอร์ทัลไรเดอร์
      </footer>
    </div>
  );
}
