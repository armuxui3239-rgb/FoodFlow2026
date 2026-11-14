'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Search, Star, Store } from 'lucide-react';
import { api } from '@/lib/client';
import { AdminFooter, AdminHeader } from '@/components/portal/admin-header';

interface RestaurantRow {
  id: string;
  name: string;
  slug: string;
  is_open: boolean;
  is_active: boolean;
  approval_status: string;
  rating: number | null;
  total_reviews: number | null;
  logo_url: string | null;
  city: string | null;
}

/** แท็บสถานะอนุมัติ — ตรงกับตัวกรอง status ฝั่ง API */
const TABS: { key: string; label: string }[] = [
  { key: '', label: 'ทั้งหมด' },
  { key: 'approved', label: 'อนุมัติ' },
  { key: 'pending', label: 'รออนุมัติ' },
  { key: 'rejected', label: 'ปฏิเสธ' },
  { key: 'suspended', label: 'ระงับ' },
];

/** ป้ายสถานะอนุมัติ */
const APPR_TH: Record<string, string> = {
  approved: 'อนุมัติ',
  pending: 'รออนุมัติ',
  rejected: 'ปฏิเสธ',
  suspended: 'ระงับ',
};

function ApprovalBadge({ status }: { status: string }) {
  const style =
    status === 'approved'
      ? 'bg-black text-white'
      : status === 'pending'
        ? 'bg-[#FFC400] text-black'
        : 'bg-red-50 text-red-600';
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${style}`}>{APPR_TH[status] ?? status}</span>;
}

/** หน้าร้านค้าทั้งหมด (แอดมิน) — ค้นหา + กรองสถานะอนุมัติ */
export default function AdminRestaurantsPage() {
  const [rows, setRows] = useState<RestaurantRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [tick, setTick] = useState(0);

  const load = useCallback(() => {
    const p = new URLSearchParams();
    if (q.trim()) p.set('q', q.trim());
    if (status) p.set('status', status);
    setLoading(true);
    api<{ data: RestaurantRow[] }>(`/api/admin/restaurants?${p.toString()}`)
      .then((r) => {
        setRows(r.data);
        setError('');
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [q, status, tick]);

  useEffect(() => {
    const t = setTimeout(load, q ? 300 : 0);
    return () => clearTimeout(t);
  }, [load]);

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <AdminHeader />

      <main className="mx-auto w-full max-w-6xl flex-1 space-y-6 px-4 py-5">
        {/* หัวข้อหน้า */}
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-lg font-bold text-black">ร้านค้าทั้งหมด</h1>
          <button
            onClick={() => setTick((x) => x + 1)}
            className="flex h-10 items-center rounded-full border border-line px-3 text-xs font-semibold text-neutral-600 transition-colors hover:bg-neutral-50"
          >
            รีเฟรช
          </button>
        </div>

        {error && (
          <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </p>
        )}

        {/* ค้นหาชื่อร้าน */}
        <label className="flex h-11 items-center gap-2 rounded-full border border-line bg-neutral-50 px-4">
          <Search className="h-4 w-4 shrink-0 text-neutral-400" aria-hidden />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="ค้นหาชื่อร้าน"
            aria-label="ค้นหาชื่อร้าน"
            className="w-full bg-transparent text-sm text-black outline-none placeholder:text-neutral-400"
          />
        </label>

        {/* แท็บสถานะอนุมัติ */}
        <div role="tablist" aria-label="กรองตามสถานะอนุมัติ" className="flex gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {TABS.map((t) => (
            <button
              key={t.key || 'all'}
              role="tab"
              aria-selected={status === t.key}
              onClick={() => setStatus(t.key)}
              className={`flex h-9 shrink-0 items-center rounded-full px-3.5 text-xs font-bold transition-colors ${
                status === t.key ? 'bg-[#FFC400] text-black' : 'bg-neutral-100 text-neutral-600 hover:bg-[#FFF4CC]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-3xl bg-neutral-100" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-line px-4 py-10 text-center">
            <Store className="mx-auto h-8 w-8 text-neutral-300" aria-hidden />
            <p className="mt-2 text-sm text-neutral-400">ไม่พบร้านค้าในเงื่อนไขนี้</p>
          </div>
        ) : (
          <ul className="overflow-hidden rounded-3xl border border-line bg-white">
            {rows.map((r, i) => (
              <li key={r.id} className={i > 0 ? 'border-t border-line' : ''}>
                <Link href={`/admin/restaurants/${r.id}`} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-neutral-50">
                  {/* โลโก้ร้าน — รูปหรือไอคอนแทน */}
                  {r.logo_url ? (
                    <img src={r.logo_url} alt={`โลโก้ ${r.name}`} className="h-10 w-10 shrink-0 rounded-xl object-cover" />
                  ) : (
                    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${r.is_open ? 'bg-[#FFF4CC]' : 'bg-neutral-100'}`}>
                      <Store className={`h-4.5 w-4.5 ${r.is_open ? 'text-black' : 'text-neutral-300'}`} aria-hidden />
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 truncate-1 text-sm font-bold text-black">
                      <span aria-hidden className={`h-2 w-2 shrink-0 rounded-full ${r.is_open ? 'bg-green-500' : 'bg-neutral-300'}`} />
                      {r.name}
                    </p>
                    <p className="truncate-1 text-[11px] text-neutral-400">{r.city || r.slug}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-0.5">
                    <p className="flex items-center gap-1 text-xs font-bold text-black">
                      <Star className="h-3.5 w-3.5 fill-[#FFC400] stroke-black" aria-hidden />
                      {(r.rating ?? 0).toFixed(1)} <span className="font-normal text-neutral-400">({r.total_reviews ?? 0})</span>
                    </p>
                    <ApprovalBadge status={r.approval_status} />
                  </div>
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
