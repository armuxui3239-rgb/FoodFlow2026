'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Bike, MapPin, RefreshCw } from 'lucide-react';
import { api } from '@/lib/client';
import { AdminSubShell } from '@/components/portal/admin-header';
import type { DriverPoint } from './DriverMap';

// โหลด maplibre เฉพาะเบราว์เซอร์ — กัน SSR compile กินหน่วยความจำจนเซิร์ฟเวอร์ OOM
const DriverMap = dynamic(() => import('./DriverMap'), {
  ssr: false,
  loading: () => <div className="flex h-full items-center justify-center text-sm text-neutral-400">กำลังโหลดแผนที่…</div>,
});

interface MapDriver {
  id: string;
  name: string;
  vehicleType: string;
  plate: string | null;
  lat: number;
  lng: number;
}

const VEHICLE_TH: Record<string, string> = {
  motorbike: 'มอเตอร์ไซค์',
  car: 'รถยนต์',
  bicycle: 'จักรยาน',
};

/** หน้าแผนที่ไรเดอร์ออนไลน์ — ปักหมุดพิกัดล่าสุด + รายการพิกัดด้านล่างเสมอ */
export default function AdminDriverMapPage() {
  const [drivers, setDrivers] = useState<MapDriver[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tick, setTick] = useState(0);

  const load = useCallback(() => {
    setLoading(true);
    api<{ data: MapDriver[] }>('/api/admin/drivers/map')
      .then((r) => {
        setDrivers(r.data);
        setError('');
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const t = setTimeout(load, 0); // หน่วงออกจาก effect body กัน cascading render
    return () => clearTimeout(t);
  }, [load, tick]);

  // memoize points ด้วยคีย์สตริงคงที่ (id+พิกัด) — กัน map ถูกสร้างใหม่ทุกครั้งที่ identity ของ array เปลี่ยน
  const pointsKey = drivers.map((d) => `${d.id}:${d.lat.toFixed(5)},${d.lng.toFixed(5)}`).join('|');
  const points: DriverPoint[] = useMemo(
    () => drivers.map((d) => ({ lng: d.lng, lat: d.lat, label: d.name })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pointsKey],
  );

  return (
    <AdminSubShell title="แผนที่ไรเดอร์ออนไลน์" subtitle="ตำแหน่งล่าสุดของไรเดอร์ที่เปิดรับงาน" backHref="/admin/drivers" Icon={MapPin} right={
      <button
        onClick={() => setTick((x) => x + 1)}
        className="flex h-10 items-center gap-1.5 rounded-full border border-line px-3 text-xs font-semibold text-neutral-600 transition-colors hover:bg-neutral-50"
      >
        <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} aria-hidden /> รีเฟรช
      </button>
    }>
      {error && (
        <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </p>
      )}

      {loading ? (
        <div className="h-[50vh] animate-pulse rounded-3xl bg-neutral-100" />
      ) : points.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-line px-4 py-10 text-center">
          <Bike className="mx-auto h-8 w-8 text-neutral-300" aria-hidden />
          <p className="mt-2 text-sm text-neutral-400">ยังไม่มีไรเดอร์ออนไลน์ที่รายงานพิกัด</p>
        </div>
      ) : (
        <>
          {/* ผืนแผนที่ (หากโหลดไม่ได้ ใช้รายการพิกัดด้านล่างแทนได้) */}
          <div className="h-[50vh] overflow-hidden rounded-3xl border border-line">
            <DriverMap points={points} />
          </div>

          {/* รายการพิกัดล่าสุด — แสดงละติจูด/ลองจิจูดจริงกำกับทุกคัน */}
          <section aria-label="รายการไรเดอร์ออนไลน์" className="space-y-2">
            <h2 className="text-sm font-bold text-black">ไรเดอร์ออนไลน์ ({drivers.length} คน)</h2>
            <ul className="grid gap-2 sm:grid-cols-2">
              {drivers.map((d) => (
                <li key={d.id} className="rounded-2xl border border-line px-4 py-3">
                  <p className="truncate-1 text-sm font-bold text-black">{d.name}</p>
                  <p className="text-[11px] text-neutral-400">
                    {VEHICLE_TH[d.vehicleType] ?? d.vehicleType}
                    {d.plate ? ` · ${d.plate}` : ''}
                  </p>
                  <p className="mt-1 font-mono text-[11px] text-neutral-500">
                    {d.lat.toFixed(5)}, {d.lng.toFixed(5)}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </AdminSubShell>
  );
}
