'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Bike, BadgeCheck, RefreshCw, Star } from 'lucide-react';
import { api, baht } from '@/lib/client';
import { AdminFooter, AdminHeader } from '@/components/portal/admin-header';

interface DriverRow {
  id: string;
  vehicle_type: string;
  vehicle_plate: string | null;
  is_online: boolean;
  is_verified: boolean;
  rating: number | null;
  total_deliveries: number;
  total_earnings: number;
  user: { full_name: string; email: string; phone: string | null } | null;
}

interface Stats {
  total: number;
  online: number;
  verified: number;
}

const VEHICLE_TH: Record<string, string> = {
  motorbike: 'มอเตอร์ไซค์',
  car: 'รถยนต์',
  bicycle: 'จักรยาน',
};

type FilterKey = 'all' | 'online' | 'unverified';

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'ทั้งหมด' },
  { key: 'online', label: 'ออนไลน์' },
  { key: 'unverified', label: 'รอยืนยัน' },
];

/** หน้ารายชื่อไรเดอร์ — สถิติรวม + ตัวกรอง + รายการพร้อมลิงก์เข้าโปรไฟล์ */
export default function AdminDriversPage() {
  const [drivers, setDrivers] = useState<DriverRow[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, online: 0, verified: 0 });
  const [filter, setFilter] = useState<FilterKey>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tick, setTick] = useState(0);

  const load = useCallback(() => {
    setLoading(true);
    api<{ data: DriverRow[]; stats: Stats }>('/api/admin/drivers')
      .then((r) => {
        setDrivers(r.data);
        setStats(r.stats);
        setError('');
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const t = setTimeout(load, 0); // หน่วงออกจาก effect body กัน cascading render
    return () => clearTimeout(t);
  }, [load, tick]);

  const filtered = drivers.filter((d) =>
    filter === 'online' ? d.is_online : filter === 'unverified' ? !d.is_verified : true,
  );

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <AdminHeader />

      <main className="mx-auto w-full max-w-6xl flex-1 space-y-5 px-4 py-5">
        <div className="flex items-center justify-between gap-2">
          <h1 className="flex items-center gap-2 text-lg font-bold text-black">
            <Bike className="h-5 w-5" aria-hidden /> ไรเดอร์ทั้งหมด
          </h1>
          <button
            onClick={() => setTick((x) => x + 1)}
            className="flex items-center gap-1.5 rounded-full border border-line px-3 py-2 text-xs font-semibold text-neutral-600 transition-colors hover:bg-neutral-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} aria-hidden /> รีเฟรช
          </button>
        </div>

        {/* การ์ดสถิติรวม */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'ไรเดอร์ทั้งหมด', value: stats.total },
            { label: 'ออนไลน์ตอนนี้', value: stats.online },
            { label: 'ยืนยันแล้ว', value: stats.verified },
          ].map((c) => (
            <div key={c.label} className="rounded-3xl border border-line bg-white p-4 shadow-sm">
              <p className="text-[11px] font-semibold text-neutral-400">{c.label}</p>
              <p className="mt-1 text-2xl font-bold text-black">{loading ? '—' : c.value}</p>
            </div>
          ))}
        </div>

        {/* ตัวกรอง */}
        <div role="tablist" aria-label="กรองไรเดอร์" className="flex gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              role="tab"
              aria-selected={filter === f.key}
              onClick={() => setFilter(f.key)}
              className={`flex h-9 items-center rounded-full px-3.5 text-xs font-bold transition-colors ${
                filter === f.key ? 'bg-[#FFC400] text-black' : 'bg-neutral-100 text-neutral-600 hover:bg-[#FFF4CC]'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {error && (
          <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </p>
        )}

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-3xl bg-neutral-100" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-line px-4 py-10 text-center">
            <Bike className="mx-auto h-8 w-8 text-neutral-300" aria-hidden />
            <p className="mt-2 text-sm text-neutral-400">ยังไม่มีไรเดอร์ในเงื่อนไขนี้</p>
          </div>
        ) : (
          <ul className="overflow-hidden rounded-3xl border border-line bg-white">
            {filtered.map((d, i) => (
              <li key={d.id} className={i > 0 ? 'border-t border-line' : ''}>
                <Link
                  href={`/admin/drivers/${d.id}`}
                  className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-[#FFFDF2]"
                >
                  <span
                    aria-label={d.is_online ? 'ออนไลน์' : 'ออฟไลน์'}
                    className={`h-2.5 w-2.5 shrink-0 rounded-full ${d.is_online ? 'bg-green-500' : 'bg-neutral-300'}`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 truncate-1 text-sm font-bold text-black">
                      {d.user?.full_name ?? 'ไรเดอร์'}
                      {d.is_verified && (
                        <BadgeCheck className="h-4 w-4 shrink-0 text-green-600" aria-label="ยืนยันแล้ว" />
                      )}
                    </p>
                    <p className="truncate-1 text-[11px] text-neutral-400">
                      {VEHICLE_TH[d.vehicle_type] ?? d.vehicle_type}
                      {d.vehicle_plate ? ` · ${d.vehicle_plate}` : ''} · {d.total_deliveries} งานส่ง ·{' '}
                      {baht(d.total_earnings)}
                    </p>
                  </div>
                  <span className="flex shrink-0 items-center gap-1 text-sm font-bold text-black">
                    <Star className="h-4 w-4 fill-[#FFC400] text-[#FFC400]" aria-hidden />
                    {d.rating != null ? d.rating.toFixed(1) : '-'}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>

      <AdminFooter />
    </div>
  );
}
