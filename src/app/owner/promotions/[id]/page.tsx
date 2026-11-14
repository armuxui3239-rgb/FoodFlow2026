'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, BadgePercent, Pencil, Store } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { api, baht, useSession } from '@/lib/client';

interface PromoFull {
  id: string;
  code: string;
  name: string;
  description: string | null;
  type: string;
  value: number;
  min_order_amount: number;
  max_discount: number | null;
  usage_limit: number;
  usage_count: number;
  max_per_user: number | null;
  first_order_only: boolean;
  starts_at: string;
  expires_at: string;
  is_active: boolean;
}

/** หน้ารายละเอียดคูปอง — สถิติการใช้งานแบบ progress bar + เปิด/ปิดใช้งาน */
export default function OwnerPromotionDetailPage() {
  const { user, ready } = useSession();
  const params = useParams<{ id: string }>();
  const id = params?.id;

  const [promo, setPromo] = useState<PromoFull | null>(null);
  const [usageCount, setUsageCount] = useState(0);
  const [totalDiscountSatang, setTotalDiscountSatang] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    if (!id) return;
    setError('');
    api<{ promotion: PromoFull; usageCount: number; totalDiscountSatang: number }>(`/api/owner/promotions/${id}`)
      .then((d) => {
        setPromo(d.promotion);
        setUsageCount(d.usageCount ?? 0);
        setTotalDiscountSatang(d.totalDiscountSatang ?? 0);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(load, [load]);

  const toggle = async (next: boolean) => {
    if (!promo) return;
    setBusy(true);
    setError('');
    const prevPromo = promo;
    setPromo({ ...promo, is_active: next });
    try {
      await api(`/api/owner/promotions/${id}`, { method: 'PATCH', body: JSON.stringify({ isActive: next }) });
    } catch (e) {
      setPromo(prevPromo);
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const denied = ready && (!user || user.role !== 'restaurant');
  const pct = promo && promo.usage_limit > 0 ? Math.min(100, Math.round((usageCount / promo.usage_limit) * 100)) : 0;
  const expired = promo ? new Date(promo.expires_at).getTime() < Date.now() : false;

  const rows: { label: string; value: string }[] = promo
    ? [
        { label: 'ประเภทส่วนลด', value: promo.type === 'percentage' ? `ลด ${promo.value}%` : `ลด ${baht(promo.value)}` },
        { label: 'ลดสูงสุด', value: promo.max_discount ? baht(promo.max_discount) : 'ไม่จำกัด' },
        { label: 'ยอดสั่งขั้นต่ำ', value: promo.min_order_amount > 0 ? baht(promo.min_order_amount) : 'ไม่มีขั้นต่ำ' },
        { label: 'จำนวนครั้งสูงสุดต่อลูกค้า', value: promo.max_per_user ? `${promo.max_per_user} ครั้ง` : 'ไม่จำกัด' },
        { label: 'เฉพาะออเดอร์แรก', value: promo.first_order_only ? 'ใช่' : 'ไม่' },
        {
          label: 'เริ่มใช้',
          value: new Date(promo.starts_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' }),
        },
        {
          label: 'หมดอายุ',
          value: new Date(promo.expires_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' }),
        },
      ]
    : [];

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <header className="sticky top-0 z-40 border-b border-line bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-3xl items-center gap-2 px-4">
          <Link
            href="/owner/promotions"
            aria-label="ย้อนกลับ"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-neutral-100 transition-transform active:scale-95"
          >
            <ArrowLeft className="h-5 w-5" aria-hidden />
          </Link>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#FFC400] text-black">
            <BadgePercent className="h-5 w-5" aria-hidden />
          </span>
          <h1 className="min-w-0 truncate-1 text-sm font-bold text-black">{promo?.code ?? 'รายละเอียดคูปอง'}</h1>
          <Link
            href={`/owner/promotions/${id}/edit`}
            className="ml-auto flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-[#FFF4CC] px-3 text-xs font-bold text-black transition-colors hover:bg-[#FFC400]"
          >
            <Pencil className="h-4 w-4" aria-hidden /> แก้ไข
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
        ) : promo && (
          <>
            {/* สรุปคูปอง */}
            <section className="rounded-3xl border border-line p-4" aria-label="สรุปคูปอง">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-black px-3 py-1.5 text-sm font-bold tracking-wider text-[#FFC400]">
                  {promo.code}
                </span>
                <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                  !promo.is_active ? 'bg-neutral-100 text-neutral-400' : expired ? 'bg-red-50 text-red-600' : 'bg-black text-[#FFC400]'
                }`}>
                  {!promo.is_active ? 'ปิดใช้งาน' : expired ? 'หมดอายุ' : 'ใช้งานอยู่'}
                </span>
              </div>
              <p className="mt-2 text-base font-bold text-black">{promo.name}</p>
              {promo.description && <p className="text-sm text-neutral-500">{promo.description}</p>}

              <div className="mt-3 flex items-center justify-between rounded-2xl bg-neutral-50 px-4 py-3">
                <span className="text-sm font-semibold text-black">เปิดใช้งานคูปอง</span>
                <Switch
                  checked={promo.is_active}
                  disabled={busy}
                  onCheckedChange={(v) => void toggle(v)}
                  aria-label="เปิด/ปิดใช้งานคูปอง"
                />
              </div>
            </section>

            {/* สถิติการใช้งาน */}
            <section className="rounded-3xl border border-line p-4" aria-label="สถิติการใช้งาน">
              <h2 className="mb-2 text-sm font-bold text-black">สถิติการใช้งาน</h2>
              <div className="h-4 w-full overflow-hidden rounded-full bg-neutral-100">
                <div className="h-full rounded-full bg-[#FFC400]" style={{ width: `${pct}%` }} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} />
              </div>
              <p className="mt-1.5 text-xs text-neutral-500">
                ใช้แล้ว {usageCount} / {promo.usage_limit} ครั้ง ({pct}%)
              </p>
              <p className="mt-2 text-sm text-black">
                ส่วนลดรวมที่ให้ลูกค้าไป: <span className="font-bold">{baht(totalDiscountSatang)}</span>
              </p>
            </section>

            {/* เงื่อนไข */}
            <section className="rounded-3xl border border-line p-4" aria-label="เงื่อนไขคูปอง">
              <h2 className="mb-2 text-sm font-bold text-black">เงื่อนไข</h2>
              <dl className="space-y-1.5 text-sm">
                {rows.map((r) => (
                  <div key={r.label} className="flex justify-between gap-2">
                    <dt className="text-neutral-500">{r.label}</dt>
                    <dd className="shrink-0 font-semibold text-black">{r.value}</dd>
                  </div>
                ))}
              </dl>
            </section>

            <p className="flex items-center justify-center gap-1.5 text-xs text-neutral-300">
              <Store className="h-3.5 w-3.5" aria-hidden /> คูปองนี้ใช้ได้เฉพาะกับออเดอร์ของร้านคุณเท่านั้น
            </p>
          </>
        )}
      </main>

      <footer className="mt-auto border-t border-line bg-white pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-4 text-center text-xs text-neutral-400">
        © {new Date().getFullYear()} ฟู๊ด ธันเดอร์ — พอร์ทัลร้านค้า
      </footer>
    </div>
  );
}
