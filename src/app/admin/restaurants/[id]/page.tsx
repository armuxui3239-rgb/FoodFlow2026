'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, MapPin, Phone, Star, Store, TrendingUp, Wallet } from 'lucide-react';
import { api, baht, STATUS_COLOR, STATUS_TH, useSession } from '@/lib/client';

interface Detail {
  restaurant: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    address_line: string;
    city: string;
    district: string | null;
    phone: string | null;
    cuisine_types: string[] | null;
    price_range: string;
    rating: number;
    total_reviews: number;
    is_open: boolean;
    is_active: boolean;
    approval_status: string;
    min_order_amount: number;
    prep_time_avg_minutes: number;
    created_at: string;
  };
  owners: { id: string; user_id: string; staff_role: string; is_active: boolean; user: { full_name: string; email: string; phone: string | null } | null }[];
  orders: { id: string; order_code: string; status: string; total: number; customerName: string; created_at: string }[];
  revenueSatang: number;
  deliveredCount: number;
}

const APPROVAL_TH: Record<string, string> = {
  approved: 'อนุมัติแล้ว',
  pending: 'รอตรวจสอบ',
  rejected: 'ปฏิเสธ',
  suspended: 'ถูกระงับ',
};

/** หน้ารายละเอียดร้าน (แอดมิน) — ข้อมูลร้าน, รายได้รวม, 20 ออเดอร์ล่าสุด, อนุมัติ/ระงับ/เปิด-ปิดร้าน */
export default function AdminRestaurantDetailPage() {
  useSession();
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api<Detail>(`/api/admin/restaurants/${id}`)
      .then((d) => {
        setDetail(d);
        setError('');
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(load, [load]);

  const patch = async (body: Record<string, unknown>) => {
    setBusy(true);
    setError('');
    try {
      await api(`/api/admin/restaurants/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
      setLoading(true);
      load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const r = detail?.restaurant;

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
            <Store className="h-5 w-5" aria-hidden />
          </span>
          <h1 className="truncate-1 text-sm font-bold text-black">{r?.name ?? 'รายละเอียดร้าน'}</h1>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 space-y-4 px-4 py-5">
        {error && <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-24 animate-pulse rounded-3xl bg-neutral-100" />
            ))}
          </div>
        ) : !r ? (
          <p className="rounded-3xl border border-dashed border-line px-4 py-10 text-center text-sm text-neutral-300">ไม่พบร้านนี้</p>
        ) : (
          <>
            {/* ข้อมูลร้าน */}
            <section className="rounded-3xl border border-line p-4" aria-label="ข้อมูลร้าน">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-lg font-bold text-black">{r.name}</h2>
                  <p className="truncate-1 text-xs text-neutral-400">slug {r.slug} · {r.price_range} · เริ่มใช้งาน {new Date(r.created_at).toLocaleDateString('th-TH')}</p>
                  <p className="mt-1 flex items-center gap-1 text-xs text-neutral-500"><MapPin className="h-3.5 w-3.5" aria-hidden /> {r.address_line} {r.district ?? ''} {r.city}</p>
                  {r.phone && <p className="flex items-center gap-1 text-xs text-neutral-500"><Phone className="h-3.5 w-3.5" aria-hidden /> {r.phone}</p>}
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${r.approval_status === 'approved' ? 'bg-black text-[#FFC400]' : r.approval_status === 'suspended' ? 'bg-red-50 text-red-600' : 'bg-neutral-100 text-neutral-600'}`}>
                      {APPROVAL_TH[r.approval_status] ?? r.approval_status}
                    </span>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${r.is_open ? 'bg-black text-[#FFC400]' : 'bg-neutral-100 text-neutral-500'}`}>
                      {r.is_open ? 'เปิดอยู่' : 'ปิดแล้ว'}
                    </span>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${r.is_active ? 'bg-black text-[#FFC400]' : 'bg-red-50 text-red-600'}`}>
                      {r.is_active ? 'ใช้งาน' : 'ปิดใช้งาน'}
                    </span>
                    <span className="flex items-center gap-1 rounded-full bg-[#FFF4CC] px-2 py-0.5 text-[11px] font-bold text-black">
                      <Star className="h-3 w-3 fill-[#FFC400] stroke-black" aria-hidden /> {Number(r.rating).toFixed(1)} ({r.total_reviews} รีวิว)
                    </span>
                    {(r.cuisine_types ?? []).map((c) => (
                      <span key={c} className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] text-neutral-600">{c}</span>
                    ))}
                  </div>
                </div>
                {/* ปุ่มจัดการร้าน */}
                <div className="flex flex-wrap gap-1.5">
                  {r.approval_status === 'approved' ? (
                    <button
                      onClick={() => void patch({ approvalStatus: 'suspended', isOpen: false })}
                      disabled={busy}
                      className="rounded-full border border-red-200 bg-white px-4 py-2 text-xs font-bold text-red-600 hover:bg-red-50 disabled:opacity-50"
                    >
                      ระงับร้าน
                    </button>
                  ) : (
                    <button
                      onClick={() => void patch({ approvalStatus: 'approved', isActive: true })}
                      disabled={busy}
                      className="btn-brand px-4 py-2 text-xs disabled:opacity-50"
                    >
                      อนุมัติร้าน
                    </button>
                  )}
                  <button
                    onClick={() => void patch({ isOpen: !r.is_open })}
                    disabled={busy}
                    className={`rounded-full px-4 py-2 text-xs font-bold disabled:opacity-50 ${r.is_open ? 'bg-neutral-100 text-neutral-600 hover:bg-red-50 hover:text-red-600' : 'bg-black text-[#FFC400]'}`}
                  >
                    {r.is_open ? 'ปิดร้านชั่วคราว' : 'เปิดร้าน'}
                  </button>
                  <button
                    onClick={() => void patch({ isActive: !r.is_active })}
                    disabled={busy}
                    className="rounded-full border border-line px-4 py-2 text-xs font-bold text-neutral-600 hover:bg-neutral-50 disabled:opacity-50"
                  >
                    {r.is_active ? 'ปิดใช้งานบัญชีร้าน' : 'เปิดใช้งานบัญชีร้าน'}
                  </button>
                </div>
              </div>
            </section>

            {/* เจ้าของ */}
            <section className="rounded-3xl border border-line p-4" aria-label="เจ้าของร้าน">
              <h2 className="mb-2 text-sm font-bold text-black">เจ้าของร้าน</h2>
              {detail.owners.length === 0 ? (
                <p className="py-2 text-center text-sm text-neutral-300">ยังไม่มีเจ้าของที่ผูกกับร้านนี้</p>
              ) : (
                <ul className="divide-y divide-line">
                  {detail.owners.map((o) => (
                    <li key={o.id} className="flex items-center justify-between gap-2 py-2">
                      <div className="min-w-0">
                        <Link href={`/admin/users/${o.user_id}`} className="truncate-1 text-sm font-bold text-black hover:underline">
                          {o.user?.full_name ?? '-'}
                        </Link>
                        <p className="truncate-1 text-[11px] text-neutral-400">{o.user?.email ?? '-'}</p>
                      </div>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${o.is_active ? 'bg-black text-[#FFC400]' : 'bg-neutral-100 text-neutral-500'}`}>
                        {o.is_active ? 'ใช้งาน' : 'หมดอายุ'}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* รายได้รวม */}
            <section className="grid grid-cols-2 gap-3" aria-label="รายได้รวม">
              <div className="rounded-3xl border border-line p-4">
                <Wallet className="h-5 w-5 text-black" aria-hidden />
                <p className="mt-2 text-2xl font-bold text-black">{baht(detail.revenueSatang)}</p>
                <p className="text-xs text-neutral-500">รายได้จากออเดอร์ส่งสำเร็จ (delivered + completed)</p>
              </div>
              <div className="rounded-3xl border border-line p-4">
                <TrendingUp className="h-5 w-5 text-black" aria-hidden />
                <p className="mt-2 text-2xl font-bold text-black">{detail.deliveredCount}</p>
                <p className="text-xs text-neutral-500">ออเดอร์สำเร็จทั้งหมด</p>
              </div>
            </section>

            {/* ออเดอร์ล่าสุด 20 รายการ */}
            <section aria-label="ออเดอร์ล่าสุดของร้าน">
              <h2 className="mb-2 text-sm font-bold text-black">ออเดอร์ล่าสุด (สูงสุด 20 รายการ)</h2>
              {detail.orders.length === 0 ? (
                <p className="rounded-3xl border border-dashed border-line px-4 py-10 text-center text-sm text-neutral-300">ยังไม่มีออเดอร์ในร้านนี้</p>
              ) : (
                <div className="overflow-y-auto ft-scroll rounded-3xl border border-line bg-white">
                  <table className="w-full text-left text-sm">
                    <thead className="sticky top-0 bg-[#FFF4CC] text-xs text-neutral-600">
                      <tr>
                        <th className="px-4 py-2.5 font-bold">รหัส</th>
                        <th className="hidden px-4 py-2.5 font-bold sm:table-cell">ลูกค้า</th>
                        <th className="px-4 py-2.5 font-bold">สถานะ</th>
                        <th className="hidden px-4 py-2.5 font-bold md:table-cell">วันที่</th>
                        <th className="px-4 py-2.5 text-right font-bold">ยอด</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.orders.map((o) => (
                        <tr key={o.id} className="border-t border-line">
                          <td className="px-4 py-2.5">
                            <Link href={`/admin/orders/${o.id}`} className="text-xs font-bold text-black hover:underline">{o.order_code}</Link>
                          </td>
                          <td className="hidden max-w-40 truncate-1 px-4 py-2.5 text-neutral-500 sm:table-cell">{o.customerName}</td>
                          <td className="px-4 py-2.5">
                            <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${STATUS_COLOR[o.status] ?? 'bg-neutral-100 text-neutral-700'}`}>
                              {STATUS_TH[o.status] ?? o.status}
                            </span>
                          </td>
                          <td className="hidden px-4 py-2.5 text-xs text-neutral-400 md:table-cell">
                            {new Date(o.created_at).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })}
                          </td>
                          <td className="px-4 py-2.5 text-right font-bold text-black">{baht(o.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
      </main>

      <footer className="mt-auto border-t border-line bg-white pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-4 text-center text-xs text-neutral-400">
        © {new Date().getFullYear()} ฟู๊ด ธันเดอร์ — ศูนย์ควบคุมผู้ดูแลระบบ
      </footer>
    </div>
  );
}
