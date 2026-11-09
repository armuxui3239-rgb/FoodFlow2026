'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Building2, Star } from 'lucide-react';
import { api } from '@/lib/client';

interface RestaurantRow {
  id: string;
  name: string;
  slug: string;
  is_open: boolean;
  is_active: boolean;
  approval_status: string;
  rating: number | null;
}

const STATUS_TH: Record<string, string> = {
  approved: 'อนุมัติแล้ว',
  pending: 'รอตรวจสอบ',
  rejected: 'ปฏิเสธ',
  suspended: 'ถูกระงับ',
};

/** หน้าอนุมัติร้าน (แอดมิน) — เปลี่ยนสถานะอนุมัติ/เปิด-ปิดร้านจริง */
export default function AdminApprovalsPage() {
  const [rows, setRows] = useState<RestaurantRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api<{ data: RestaurantRow[] }>('/api/admin/approvals')
      .then((d) => setRows(d.data))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  const patch = async (r: RestaurantRow, body: Record<string, unknown>) => {
    setBusyId(r.id);
    setError('');
    try {
      await api('/api/admin/approvals', { method: 'PATCH', body: JSON.stringify({ restaurantId: r.id, ...body }) });
      load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyId(null);
    }
  };

  const pending = rows.filter((r) => r.approval_status !== 'approved');

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <header className="sticky top-0 z-40 border-b border-line bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-2 px-4">
          <Link
            href="/admin"
            aria-label="ย้อนกลับ"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-neutral-100 transition-transform active:scale-95"
          >
            <ArrowLeft className="h-5 w-5" aria-hidden />
          </Link>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-black text-[#FFC400]">
            <Building2 className="h-5 w-5" aria-hidden />
          </span>
          <h1 className="text-sm font-bold text-black">อนุมัติร้าน ({rows.length} ร้าน)</h1>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 space-y-5 px-4 py-5">
        {error && <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}

        {/* ร้านรอดำเนินการ */}
        {pending.length > 0 && (
          <section aria-label="รอดำเนินการ">
            <h2 className="mb-2 flex items-center gap-2 text-sm font-bold text-black">
              รอดำเนินการ <span className="rounded-full bg-[#FFC400] px-2 py-0.5 text-[11px] font-bold text-black">{pending.length}</span>
            </h2>
            <ul className="space-y-2">
              {pending.map((r) => (
                <li key={r.id} className="rounded-3xl border border-[#FFC400] bg-[#FFF4CC] p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate-1 text-sm font-bold text-black">{r.name}</p>
                      <p className="text-[11px] text-neutral-500">slug {r.slug} · {STATUS_TH[r.approval_status] ?? r.approval_status}</p>
                    </div>
                    <button
                      onClick={() => void patch(r, { approvalStatus: 'approved', isActive: true })}
                      disabled={busyId === r.id}
                      className="btn-brand shrink-0 px-4 py-2 text-xs disabled:opacity-50"
                    >
                      อนุมัติร้าน
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* ร้านทั้งหมด */}
        <section aria-label="ร้านทั้งหมด">
          <h2 className="mb-2 text-sm font-bold text-black">ร้านทั้งหมด</h2>
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-16 animate-pulse rounded-3xl bg-neutral-100" />
              ))}
            </div>
          ) : (
            <ul className="overflow-hidden rounded-3xl border border-line bg-white">
              {rows.map((r, i) => (
                <li key={r.id} className={`flex flex-wrap items-center gap-2 px-4 py-3 ${i > 0 ? 'border-t border-line' : ''}`}>
                  <div className="min-w-0 flex-1">
                    <p className="truncate-1 text-sm font-bold text-black">{r.name}</p>
                    <p className="flex items-center gap-2 text-[11px] text-neutral-400">
                      <span className={`rounded-full px-2 py-0.5 font-bold ${
                        r.approval_status === 'approved' ? 'bg-black text-[#FFC400]' : r.approval_status === 'suspended' ? 'bg-red-50 text-red-600' : 'bg-neutral-100 text-neutral-500'
                      }`}>
                        {STATUS_TH[r.approval_status] ?? r.approval_status}
                      </span>
                      <span className="flex items-center gap-1">
                        <Star className="h-3 w-3 fill-[#FFC400] stroke-black" aria-hidden />
                        {(r.rating ?? 0).toFixed(1)}
                      </span>
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1.5">
                    <button
                      onClick={() => void patch(r, { isOpen: !r.is_open })}
                      disabled={busyId === r.id}
                      className={`rounded-full px-3 py-1.5 text-[11px] font-bold disabled:opacity-50 ${r.is_open ? 'bg-neutral-100 text-neutral-600 hover:bg-red-50 hover:text-red-600' : 'bg-black text-[#FFC400]'}`}
                    >
                      {r.is_open ? 'ปิดร้านชั่วคราว' : 'เปิดร้าน'}
                    </button>
                    {r.approval_status === 'approved' ? (
                      <button
                        onClick={() => void patch(r, { approvalStatus: 'suspended', isOpen: false })}
                        disabled={busyId === r.id}
                        className="rounded-full bg-red-50 px-3 py-1.5 text-[11px] font-bold text-red-600 hover:bg-red-100 disabled:opacity-50"
                      >
                        ระงับร้าน
                      </button>
                    ) : (
                      <button
                        onClick={() => void patch(r, { approvalStatus: 'approved', isActive: true })}
                        disabled={busyId === r.id}
                        className="rounded-full bg-black px-3 py-1.5 text-[11px] font-bold text-[#FFC400] disabled:opacity-50"
                      >
                        อนุมัติ
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>

      <footer className="mt-auto border-t border-line bg-white pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-4 text-center text-xs text-neutral-400">
        © {new Date().getFullYear()} ฟู๊ด ธันเดอร์ — ศูนย์ควบคุมผู้ดูแลระบบ
      </footer>
    </div>
  );
}
