'use client';

import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ArrowLeft, Bike, MapPin, Store } from 'lucide-react';
import { api, STATUS_TH } from '@/lib/client';
import type { MapPoint } from './MapCanvas';

// โหลด maplibre เฉพาะเบราว์เซอร์ — กัน SSR compile กินหน่วยความจำจนเซิร์ฟเวอร์ OOM
const MapCanvas = dynamic(() => import('./MapCanvas'), {
  ssr: false,
  loading: () => <div className="flex h-full items-center justify-center text-sm text-neutral-400">กำลังโหลดแผนที่…</div>,
});

interface MapData {
  order: { id: string; code: string; status: string };
  restaurant: { name: string; address: string; coords: [number, number] | null };
  dropoff: { address: string; coords: [number, number] | null };
  driver: { name: string; lat: number | null; lng: number | null } | null;
}

/** หน้าแผนที่ติดตามไรเดอร์ — แผนที่ OSM จริง (OpenFreeMap ผ่าน proxy ของเรา) */
export default function OrderMapPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<MapData | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<MapData>(`/api/orders/${id}/map`)
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  const points: MapPoint[] = [];
  if (data?.restaurant.coords) points.push({ lng: data.restaurant.coords[0], lat: data.restaurant.coords[1], label: 'restaurant' });
  if (data?.dropoff.coords) points.push({ lng: data.dropoff.coords[0], lat: data.dropoff.coords[1], label: 'dropoff' });
  if (data?.driver?.lat && data?.driver?.lng) points.push({ lng: data.driver.lng, lat: data.driver.lat, label: 'driver' });

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <header className="sticky top-0 z-40 border-b border-line bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-2 px-4">
          <Link
            href={`/orders/${id}`}
            aria-label="ย้อนกลับ"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-neutral-100 transition-transform active:scale-95"
          >
            <ArrowLeft className="h-5 w-5" aria-hidden />
          </Link>
          <div className="min-w-0">
            <h1 className="truncate-1 text-sm font-bold text-black">แผนที่เส้นทางจัดส่ง</h1>
            <p className="text-[11px] text-neutral-400">
              {data ? `#${data.order.code} · ${STATUS_TH[data.order.status] ?? data.order.status}` : 'กำลังโหลด…'}
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-4">
        {error && (
          <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </p>
        )}
        {loading ? (
          <div className="h-[60vh] animate-pulse rounded-3xl bg-neutral-100" />
        ) : (
          <>
            <div className="relative h-[60vh] overflow-hidden rounded-3xl border border-line">
              {points.length > 0 ? (
                <MapCanvas points={points} />
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-neutral-400">
                  ไม่มีพิกัดสำหรับคำสั่งซื้อนี้
                </div>
              )}
            </div>

            <section aria-label="รายละเอียดจุดรับ-จ่าย" className="mt-4 space-y-2">
              {data?.restaurant && (
                <p className="flex items-start gap-2 rounded-2xl border border-line px-4 py-3 text-sm">
                  <Store className="mt-0.5 h-4 w-4 shrink-0 text-black" aria-hidden />
                  <span>
                    <b>จุดรับ:</b> {data.restaurant.name} — {data.restaurant.address}
                  </span>
                </p>
              )}
              {data?.dropoff && (
                <p className="flex items-start gap-2 rounded-2xl border border-line px-4 py-3 text-sm">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-black" aria-hidden />
                  <span>
                    <b>จุดส่ง:</b> {data.dropoff.address || 'ไม่มีที่อยู่'}
                  </span>
                </p>
              )}
              {data?.driver && (
                <p className="flex items-start gap-2 rounded-2xl bg-[#FFF4CC] px-4 py-3 text-sm">
                  <Bike className="mt-0.5 h-4 w-4 shrink-0 text-black" aria-hidden />
                  <span>
                    <b>ไรเดอร์:</b> {data.driver.name}
                    {data.driver.lat && data.driver.lng ? ' (แสดงตำแหน่งล่าสุดบนแผนที่)' : ' (ยังไม่มีตำแหน่งล่าสุด)'}
                  </span>
                </p>
              )}
            </section>
          </>
        )}
      </main>

      <footer className="mt-auto border-t border-line bg-white pb-[calc(env(safe-area-inset-bottom)+5.5rem)] pt-4 text-center text-xs text-neutral-400">
        © {new Date().getFullYear()} ฟู๊ด ธันเดอร์ — แผนที่โดย OpenStreetMap/OpenFreeMap
      </footer>
    </div>
  );
}
