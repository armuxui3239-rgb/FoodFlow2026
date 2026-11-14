'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, BadgePercent, Pencil, Ticket, Trash2, Users } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { api, baht, useSession } from '@/lib/client';

interface PromoDetail {
  promotion: {
    id: string;
    code: string;
    name: string;
    description: string | null;
    type: string;
    value: number;
    min_order_amount: number;
    max_discount: number | null;
    usage_count: number;
    usage_limit: number | null;
    max_per_user: number | null;
    first_order_only: boolean;
    is_stackable: boolean;
    starts_at: string;
    expires_at: string | null;
    is_active: boolean;
    status: string;
  };
  usages: { id: string; userName: string; userEmail: string; discount_amount: number; used_at: string; order_id: string }[];
  stats: { totalUsed: number; recentUsedCapped: number; totalDiscountSatang: number; distinctUsers: number };
}

/** หน้ารายละเอียดคูปอง (แอดมิน) — สถิติการใช้ + รายการใช้ล่าสุด + แก้ไข/ลบ */
export default function AdminPromotionDetailPage() {
  useSession();
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [detail, setDetail] = useState<PromoDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(() => {
    api<PromoDetail>(`/api/admin/promotions/${params.id}`)
      .then((d) => {
        setDetail(d);
        setError('');
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [params.id]);

  useEffect(load, [load]);

  const remove = async () => {
    setDeleting(true);
    setError('');
    try {
      await api(`/api/admin/promotions/${params.id}`, { method: 'DELETE' });
      router.push('/admin/promotions');
    } catch (e) {
      setError((e as Error).message);
      setDeleteOpen(false);
      setDeleting(false);
    }
  };

  const p = detail?.promotion;

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <header className="sticky top-0 z-40 border-b border-line bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-2 px-4">
          <Link
            href="/admin/promotions"
            aria-label="ย้อนกลับ"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-neutral-100 transition-transform active:scale-95"
          >
            <ArrowLeft className="h-5 w-5" aria-hidden />
          </Link>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-black text-[#FFC400]">
            <Ticket className="h-5 w-5" aria-hidden />
          </span>
          <h1 className="truncate-1 text-sm font-bold text-black">{p ? `${p.code} · ${p.name}` : 'รายละเอียดคูปอง'}</h1>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 space-y-4 px-4 py-5">
        {error && <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-20 animate-pulse rounded-3xl bg-neutral-100" />
            ))}
          </div>
        ) : !p ? (
          <p className="rounded-3xl border border-dashed border-line px-4 py-10 text-center text-sm text-neutral-300">ไม่พบคูปองนี้</p>
        ) : (
          <>
            {/* ข้อมูลคูปอง */}
            <section className="rounded-3xl border border-line p-4" aria-label="ข้อมูลคูปอง">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 text-lg font-bold text-black">
                    {p.code}
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${p.is_active ? 'bg-black text-[#FFC400]' : 'bg-neutral-100 text-neutral-500'}`}>
                      {p.is_active ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
                    </span>
                  </p>
                  <p className="text-sm text-neutral-600">{p.name}</p>
                  {p.description && <p className="mt-1 text-xs text-neutral-400">{p.description}</p>}
                  <p className="mt-2 text-xs text-neutral-500">
                    {p.type === 'percentage' ? `ลด ${p.value}%` : `ลด ${baht(p.value)}`} · ขั้นต่ำ {baht(p.min_order_amount)}
                    {p.max_discount ? ` · ลดสูงสุด ${baht(p.max_discount)}` : ''}
                    {` · ใช้ได้ ${p.usage_count}${p.usage_limit ? `/${p.usage_limit}` : ''} ครั้ง`}
                  </p>
                  <p className="text-xs text-neutral-500">
                    ใช้ได้ {new Date(p.starts_at).toLocaleDateString('th-TH')} – {p.expires_at ? new Date(p.expires_at).toLocaleDateString('th-TH') : 'ไม่มีวันหมดอายุ'}
                    {p.max_per_user ? ` · ต่อผู้ใช้ ${p.max_per_user} ครั้ง` : ''}
                    {p.first_order_only ? ' · เฉพาะออเดอร์แรก' : ''}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1.5">
                  <Link href={`/admin/promotions/${p.id}/edit`} className="btn-brand flex h-10 items-center gap-1.5 px-4 text-xs">
                    <Pencil className="h-4 w-4" aria-hidden /> แก้ไข
                  </Link>
                  <button
                    onClick={() => setDeleteOpen(true)}
                    className="flex h-10 items-center gap-1.5 rounded-full bg-red-50 px-4 text-xs font-bold text-red-600 transition-colors hover:bg-red-100"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden /> ลบ
                  </button>
                </div>
              </div>
            </section>

            {/* สถิติการใช้ */}
            <section className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label="สถิติการใช้คูปอง">
              <div className="rounded-3xl border border-line p-4">
                <BadgePercent className="h-5 w-5 text-black" aria-hidden />
                <p className="mt-2 text-2xl font-bold text-black">{detail.stats.totalUsed}</p>
                <p className="text-xs text-neutral-500">ใช้ทั้งหมด (ครั้ง)</p>
              </div>
              <div className="rounded-3xl border border-line p-4">
                <Users className="h-5 w-5 text-black" aria-hidden />
                <p className="mt-2 text-2xl font-bold text-black">{detail.stats.distinctUsers}</p>
                <p className="text-xs text-neutral-500">ผู้ใช้ที่ใช้แล้ว</p>
              </div>
              <div className="rounded-3xl border border-line p-4">
                <p className="mt-5 text-2xl font-bold text-black">{baht(detail.stats.totalDiscountSatang)}</p>
                <p className="text-xs text-neutral-500">ส่วนลดรวมที่ให้ไป</p>
              </div>
              <div className="rounded-3xl border border-line p-4">
                <p className="mt-5 text-2xl font-bold text-black">{p.usage_limit ? `${Math.min(100, Math.round((detail.stats.totalUsed / p.usage_limit) * 100))}%` : '–'}</p>
                <p className="text-xs text-neutral-500">ความคืบหน้าเทียบโควตา</p>
              </div>
            </section>

            {/* รายการใช้ล่าสุด */}
            <section aria-label="รายการใช้คูปองล่าสุด">
              <h2 className="mb-2 text-sm font-bold text-black">การใช้งานล่าสุด (สูงสุด 20 รายการ)</h2>
              {detail.usages.length === 0 ? (
                <p className="rounded-3xl border border-dashed border-line px-4 py-10 text-center text-sm text-neutral-300">ยังไม่มีใครใช้คูปองนี้</p>
              ) : (
                <div className="overflow-y-auto ft-scroll rounded-3xl border border-line bg-white">
                  <table className="w-full text-left text-sm">
                    <thead className="sticky top-0 bg-[#FFF4CC] text-xs text-neutral-600">
                      <tr>
                        <th className="px-4 py-2.5 font-bold">ผู้ใช้</th>
                        <th className="hidden px-4 py-2.5 font-bold sm:table-cell">อีเมล</th>
                        <th className="hidden px-4 py-2.5 font-bold md:table-cell">เมื่อ</th>
                        <th className="px-4 py-2.5 text-right font-bold">ส่วนลด</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.usages.map((u) => (
                        <tr key={u.id} className="border-t border-line">
                          <td className="px-4 py-2.5 font-bold text-black">{u.userName}</td>
                          <td className="hidden max-w-40 truncate-1 px-4 py-2.5 text-neutral-500 sm:table-cell">{u.userEmail}</td>
                          <td className="hidden px-4 py-2.5 text-xs text-neutral-400 md:table-cell">
                            {new Date(u.used_at).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })}
                          </td>
                          <td className="px-4 py-2.5 text-right font-bold text-black">{baht(u.discount_amount)}</td>
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

      {/* ยืนยันลบคูปอง */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle>ลบคูปอง “{p?.code}” ถาวร?</AlertDialogTitle>
            <AlertDialogDescription>
              คูปองจะหายจากระบบทันทีและกู้คืนไม่ได้ ประวัติการใช้งานเดิมจะยังอยู่ในระบบ แต่โค้ดนี้ใช้สั่งซื้อไม่ได้อีก
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full">ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); void remove(); }}
              disabled={deleting}
              className="rounded-full bg-red-600 text-white disabled:opacity-50"
            >
              {deleting ? 'กำลังลบ…' : 'ลบคูปอง'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <footer className="mt-auto border-t border-line bg-white pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-4 text-center text-xs text-neutral-400">
        © {new Date().getFullYear()} ฟู๊ด ธันเดอร์ — ศูนย์ควบคุมผู้ดูแลระบบ
      </footer>
    </div>
  );
}
