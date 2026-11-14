'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, BadgePercent, PlusCircle, Store } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { api, baht, useSession } from '@/lib/client';

interface Promo {
  id: string;
  code: string;
  name: string;
  type: string;
  value: number;
  min_order_amount: number;
  max_discount: number | null;
  usage_limit: number;
  usage_count: number;
  expires_at: string;
  is_active: boolean;
}

/** สถานะคูปองแบบง่าย: ปิดใช้งาน / หมดอายุ / ใช้งานอยู่ (fork ใช้ is_active + วันหมดอายุเป็นหลัก) */
function promoState(p: Promo): { label: string; cls: string } {
  if (!p.is_active) return { label: 'ปิดใช้งาน', cls: 'bg-neutral-100 text-neutral-400' };
  if (new Date(p.expires_at).getTime() < Date.now()) return { label: 'หมดอายุ', cls: 'bg-red-50 text-red-600' };
  return { label: 'ใช้งานอยู่', cls: 'bg-black text-[#FFC400]' };
}

/** หน้ารายการคูปองของร้าน — เปิด/ปิดใช้งานแบบ optimistic */
export default function OwnerPromotionsPage() {
  const { user, ready } = useSession();
  const [promos, setPromos] = useState<Promo[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setError('');
    api<{ data: Promo[] }>('/api/owner/promotions')
      .then((d) => setPromos(d.data ?? []))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  const toggle = async (p: Promo, next: boolean) => {
    setBusyId(p.id);
    setError('');
    const prev = promos;
    setPromos((xs) => xs.map((x) => (x.id === p.id ? { ...x, is_active: next } : x)));
    try {
      await api(`/api/owner/promotions/${p.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: next }),
      });
    } catch (e) {
      setPromos(prev);
      setError((e as Error).message);
    } finally {
      setBusyId(null);
    }
  };

  const denied = ready && (!user || user.role !== 'restaurant');

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <header className="sticky top-0 z-40 border-b border-line bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-3xl items-center gap-2 px-4">
          <Link
            href="/owner"
            aria-label="ย้อนกลับ"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-neutral-100 transition-transform active:scale-95"
          >
            <ArrowLeft className="h-5 w-5" aria-hidden />
          </Link>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#FFC400] text-black">
            <BadgePercent className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-bold text-black">คูปองส่วนลดของร้าน</p>
            <p className="text-[11px] text-neutral-400">สร้างโปรโมชั่นเฉพาะร้านของคุณ</p>
          </div>
          <Link
            href="/owner/promotions/new"
            className="ml-auto flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-[#FFF4CC] px-3 text-xs font-bold text-black transition-colors hover:bg-[#FFC400]"
          >
            <PlusCircle className="h-4 w-4" aria-hidden /> สร้างคูปอง
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 space-y-4 px-4 py-5">
        {denied && (
          <p role="alert" className="rounded-2xl bg-[#FFF4CC] px-4 py-3 text-sm font-semibold text-black">
            หน้านี้สำหรับเจ้าของร้านเท่านั้น กรุณาเข้าสู่ระบบด้วยบัญชีร้านค้า
          </p>
        )}
        {error && (
          <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </p>
        )}

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-24 animate-pulse rounded-3xl bg-neutral-100" />
            ))}
          </div>
        ) : promos.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line px-4 py-6 text-center text-sm text-neutral-300">
            ยังไม่มีคูปอง — กด &ldquo;สร้างคูปอง&rdquo; เพื่อเริ่มทำโปรโมชั่น
          </p>
        ) : (
          <ul className="space-y-3">
            {promos.map((p) => {
              const st = promoState(p);
              return (
                <li key={p.id} className="rounded-3xl border border-line bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-lg bg-black px-2 py-1 text-xs font-bold tracking-wider text-[#FFC400]">
                          {p.code}
                        </span>
                        <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${st.cls}`}>{st.label}</span>
                      </div>
                      <Link href={`/owner/promotions/${p.id}`} className="mt-1.5 block truncate-1 text-sm font-bold text-black hover:underline">
                        {p.name}
                      </Link>
                      <p className="text-xs text-neutral-500">
                        {p.type === 'percentage' ? `ลด ${p.value}%` : `ลด ${baht(p.value)}`}
                        {p.max_discount ? ` (สูงสุด ${baht(p.max_discount)})` : ''}
                        {p.min_order_amount > 0 ? ` · ขั้นต่ำ ${baht(p.min_order_amount)}` : ''}
                      </p>
                      <p className="mt-0.5 text-xs text-neutral-400">
                        ใช้แล้ว {p.usage_count}/{p.usage_limit} ครั้ง · หมดอายุ{' '}
                        {new Date(p.expires_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-center gap-1">
                      <Switch
                        checked={p.is_active}
                        disabled={busyId === p.id}
                        onCheckedChange={(v) => void toggle(p, v)}
                        aria-label={`เปิด/ปิดคูปอง ${p.code}`}
                      />
                      <span className="text-[10px] font-bold text-neutral-400">{p.is_active ? 'เปิด' : 'ปิด'}</span>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <p className="flex items-center justify-center gap-1.5 text-xs text-neutral-300">
          <Store className="h-3.5 w-3.5" aria-hidden /> คูปองจะแสดงเฉพาะลูกค้าของร้านคุณเท่านั้น
        </p>
      </main>

      <footer className="mt-auto border-t border-line bg-white pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-4 text-center text-xs text-neutral-400">
        © {new Date().getFullYear()} ฟู๊ด ธันเดอร์ — พอร์ทัลร้านค้า
      </footer>
    </div>
  );
}
