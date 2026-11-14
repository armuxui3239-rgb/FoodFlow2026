'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Ban, ClipboardList, ShieldCheck, Star, User } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { api, baht, STATUS_COLOR, STATUS_TH, useSession } from '@/lib/client';

interface UserDetail {
  user: {
    id: string;
    email: string;
    phone: string | null;
    full_name: string;
    role: string;
    avatar_url: string | null;
    is_active: boolean;
    failed_login_count: number;
    locked_until: string | null;
    preferred_locale: string;
    created_at: string;
  };
  counts: { orders: number; reviews: number };
  lastOrders: { id: string; order_code: string; status: string; total: number; restaurantName: string; created_at: string }[];
}

const ROLE_TH: Record<string, string> = {
  customer: 'ลูกค้า',
  restaurant: 'เจ้าของร้าน',
  driver: 'ไรเดอร์',
  admin: 'ผู้ดูแลระบบ',
};

/** หน้ารายละเอียดผู้ใช้ (แอดมิน) — โปรไฟล์, สถิติ, 10 ออเดอร์ล่าสุด, ระงับ/เปิดบัญชี (ห้ามระงับตัวเอง) */
export default function AdminUserDetailPage() {
  const { user: me } = useSession();
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [detail, setDetail] = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api<UserDetail>(`/api/admin/users/${id}`)
      .then((d) => {
        setDetail(d);
        setError('');
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(load, [load]);

  const isSelf = me?.id === id;

  const toggleActive = async (next: boolean) => {
    setBusy(true);
    setError('');
    try {
      await api(`/api/admin/users/${id}`, { method: 'PATCH', body: JSON.stringify({ isActive: next }) });
      setDetail((d) => (d ? { ...d, user: { ...d.user, is_active: next } } : d));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const u = detail?.user;

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <header className="sticky top-0 z-40 border-b border-line bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-2 px-4">
          <Link
            href="/admin/users"
            aria-label="ย้อนกลับ"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-neutral-100 transition-transform active:scale-95"
          >
            <ArrowLeft className="h-5 w-5" aria-hidden />
          </Link>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-black text-[#FFC400]">
            <User className="h-5 w-5" aria-hidden />
          </span>
          <h1 className="truncate-1 text-sm font-bold text-black">{u?.full_name ?? 'รายละเอียดผู้ใช้'}</h1>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 space-y-4 px-4 py-5">
        {error && <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-24 animate-pulse rounded-3xl bg-neutral-100" />
            ))}
          </div>
        ) : !u ? (
          <p className="rounded-3xl border border-dashed border-line px-4 py-10 text-center text-sm text-neutral-300">ไม่พบผู้ใช้นี้</p>
        ) : (
          <>
            {/* โปรไฟล์ผู้ใช้ */}
            <section className="rounded-3xl border border-line p-4" aria-label="โปรไฟล์ผู้ใช้">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-lg font-bold text-black">
                    {u.full_name}
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${u.is_active ? 'bg-black text-[#FFC400]' : 'bg-red-50 text-red-600'}`}>
                      {u.is_active ? 'ใช้งานปกติ' : 'ถูกระงับ'}
                    </span>
                    {isSelf && <span className="rounded-full bg-[#FFF4CC] px-2 py-0.5 text-[11px] font-bold text-black">บัญชีของคุณ</span>}
                  </p>
                  <p className="truncate-1 text-xs text-neutral-400">{ROLE_TH[u.role] ?? u.role} · {u.email} · {u.phone ?? 'ไม่มีเบอร์โทร'}</p>
                  <p className="text-[11px] text-neutral-400">
                    สมัครเมื่อ {new Date(u.created_at).toLocaleDateString('th-TH', { dateStyle: 'long' })} · ภาษา {u.preferred_locale}
                    {u.failed_login_count > 0 ? ` · ล็อกอินผิด ${u.failed_login_count} ครั้ง` : ''}
                    {u.locked_until ? ' · บัญชีถูกล็อกชั่วคราว' : ''}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {u.is_active ? (
                    <ShieldCheck className="h-5 w-5 text-black" aria-label="บัญชีปกติ" />
                  ) : (
                    <Ban className="h-5 w-5 text-red-400" aria-label="บัญชีถูกระงับ" />
                  )}
                  <Switch
                    checked={u.is_active}
                    disabled={busy || isSelf}
                    onCheckedChange={(v) => void toggleActive(v)}
                    aria-label={`${u.is_active ? 'ระงับ' : 'เปิด'} บัญชี ${u.full_name}`}
                  />
                </div>
              </div>
              {isSelf && <p className="mt-2 text-[11px] text-neutral-400">ระงับบัญชีของตัวเองไม่ได้ตามกติกาความปลอดภัย</p>}
            </section>

            {/* สถิติ */}
            <section className="grid grid-cols-3 gap-3" aria-label="สถิติผู้ใช้">
              <div className="rounded-3xl border border-line p-4 text-center">
                <ClipboardList className="mx-auto h-5 w-5 text-black" aria-hidden />
                <p className="mt-2 text-2xl font-bold text-black">{detail.counts.orders}</p>
                <p className="text-xs text-neutral-500">ออเดอร์ทั้งหมด</p>
              </div>
              <div className="rounded-3xl border border-line p-4 text-center">
                <Star className="mx-auto h-5 w-5 text-black" aria-hidden />
                <p className="mt-2 text-2xl font-bold text-black">{detail.counts.reviews}</p>
                <p className="text-xs text-neutral-500">รีวิวทั้งหมด</p>
              </div>
              <div className="rounded-3xl border border-line p-4 text-center">
                <p className="mt-5 text-2xl font-bold text-black">{ROLE_TH[u.role] ?? u.role}</p>
                <p className="text-xs text-neutral-500">บทบาทในระบบ</p>
              </div>
            </section>

            {/* ออเดอร์ล่าสุด */}
            <section aria-label="ออเดอร์ล่าสุดของผู้ใช้">
              <h2 className="mb-2 text-sm font-bold text-black">ออเดอร์ล่าสุด (สูงสุด 10 รายการ)</h2>
              {detail.lastOrders.length === 0 ? (
                <p className="rounded-3xl border border-dashed border-line px-4 py-10 text-center text-sm text-neutral-300">ผู้ใช้นี้ยังไม่มีออเดอร์</p>
              ) : (
                <div className="overflow-y-auto ft-scroll rounded-3xl border border-line bg-white">
                  <table className="w-full text-left text-sm">
                    <thead className="sticky top-0 bg-[#FFF4CC] text-xs text-neutral-600">
                      <tr>
                        <th className="px-4 py-2.5 font-bold">รหัส</th>
                        <th className="hidden px-4 py-2.5 font-bold sm:table-cell">ร้าน</th>
                        <th className="px-4 py-2.5 font-bold">สถานะ</th>
                        <th className="hidden px-4 py-2.5 font-bold md:table-cell">วันที่</th>
                        <th className="px-4 py-2.5 text-right font-bold">ยอด</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.lastOrders.map((o) => (
                        <tr key={o.id} className="border-t border-line">
                          <td className="px-4 py-2.5">
                            <Link href={`/admin/orders/${o.id}`} className="text-xs font-bold text-black hover:underline">{o.order_code}</Link>
                          </td>
                          <td className="hidden max-w-40 truncate-1 px-4 py-2.5 text-neutral-500 sm:table-cell">{o.restaurantName}</td>
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
