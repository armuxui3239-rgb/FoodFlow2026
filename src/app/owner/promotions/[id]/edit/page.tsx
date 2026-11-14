'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, BadgePercent, Pencil } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { api, useSession } from '@/lib/client';

interface PromoFull {
  id: string;
  code: string;
  name: string;
  type: string;
  value: number;
  min_order_amount: number;
  max_discount: number | null;
  usage_limit: number;
  max_per_user: number | null;
  first_order_only: boolean;
  expires_at: string;
}

/** หน้าแก้ไขคูปอง — โหลดจาก detail API แล้วบันทึกด้วย PATCH (ราคาบาท→สตางค์ฝั่งเซิร์ฟเวอร์) */
export default function OwnerPromotionEditPage() {
  const { user, ready } = useSession();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params?.id;

  const [name, setName] = useState('');
  const [type, setType] = useState<'fixed' | 'percentage'>('fixed');
  const [value, setValue] = useState('');
  const [minOrder, setMinOrder] = useState('0');
  const [maxDiscount, setMaxDiscount] = useState('');
  const [usageLimit, setUsageLimit] = useState('100');
  const [maxPerUser, setMaxPerUser] = useState('');
  const [firstOrderOnly, setFirstOrderOnly] = useState(false);
  const [expiresAt, setExpiresAt] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notFound, setNotFound] = useState(false);

  const load = useCallback(() => {
    if (!id) return;
    api<{ promotion: PromoFull }>(`/api/owner/promotions/${id}`)
      .then((d) => {
        const p = d.promotion;
        if (!p) {
          setNotFound(true);
          return;
        }
        setName(p.name ?? '');
        setType(p.type === 'percentage' ? 'percentage' : 'fixed');
        // fixed เก็บหน่วยสตางค์ — แปลงเป็นบาทเพื่อแสดงผล, percentage แสดงตรง
        setValue(p.type === 'percentage' ? String(Number(p.value)) : String(Number(p.value) / 100));
        setMinOrder(String(Number(p.min_order_amount) / 100));
        setMaxDiscount(p.max_discount ? String(Number(p.max_discount) / 100) : '');
        setUsageLimit(String(p.usage_limit));
        setMaxPerUser(p.max_per_user ? String(p.max_per_user) : '');
        setFirstOrderOnly(p.first_order_only);
        setExpiresAt(p.expires_at ? new Date(p.expires_at).toISOString().slice(0, 10) : '');
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(load, [load]);

  const save = async () => {
    setError('');
    const valueNum = Number(value);
    if (!name.trim()) return setError('กรุณาระบุชื่อโปรโมชั่น');
    if (!Number.isFinite(valueNum) || valueNum <= 0) return setError('กรุณาระบุมูลค่าส่วนลดให้ถูกต้อง');
    if (type === 'percentage' && valueNum > 100) return setError('ส่วนลดเปอร์เซ็นต์ต้องไม่เกิน 100');

    setSaving(true);
    try {
      await api(`/api/owner/promotions/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: name.trim(),
          // fixed ส่งเป็นสตางค์ (บาท × 100), percentage เป็นจำนวนเต็ม
          value: type === 'fixed' ? Math.round(valueNum * 100) : Math.round(valueNum),
          minOrderBaht: Number(minOrder) || 0,
          maxDiscountBaht: type === 'percentage' && Number(maxDiscount) > 0 ? Number(maxDiscount) : null,
          usageLimit: Number(usageLimit) > 0 ? Number(usageLimit) : undefined,
          maxPerUser: Number(maxPerUser) > 0 ? Number(maxPerUser) : null,
          firstOrderOnly,
          ...(expiresAt ? { expiresAt } : {}),
        }),
      });
      router.push(`/owner/promotions/${id}`);
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  };

  const denied = ready && (!user || user.role !== 'restaurant');

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <header className="sticky top-0 z-40 border-b border-line bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-3xl items-center gap-2 px-4">
          <Link
            href={`/owner/promotions/${id}`}
            aria-label="ย้อนกลับ"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-neutral-100 transition-transform active:scale-95"
          >
            <ArrowLeft className="h-5 w-5" aria-hidden />
          </Link>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#FFC400] text-black">
            <Pencil className="h-5 w-5" aria-hidden />
          </span>
          <h1 className="text-sm font-bold text-black">แก้ไขคูปอง</h1>
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
              <div key={i} className="h-20 animate-pulse rounded-3xl bg-neutral-100" />
            ))}
          </div>
        ) : notFound ? (
          <p className="rounded-2xl border border-dashed border-line px-4 py-6 text-center text-sm text-neutral-500">
            ไม่พบคูปองนี้ในร้านของคุณ
          </p>
        ) : (
          <form
            className="space-y-4 rounded-3xl border border-line p-4"
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
          >
            <label className="block">
              <span className="text-sm font-bold text-black">ชื่อโปรโมชั่น *</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                maxLength={255}
                className="mt-1 h-11 w-full rounded-2xl border border-line px-3 text-sm outline-none focus:border-[#FFC400]"
              />
            </label>

            <fieldset>
              <legend className="text-sm font-bold text-black">ประเภทส่วนลด</legend>
              <RadioGroup
                value={type}
                onValueChange={(v) => setType(v === 'percentage' ? 'percentage' : 'fixed')}
                className="mt-2 grid grid-cols-2 gap-3"
              >
                <label
                  className={`flex cursor-pointer items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold transition-colors ${
                    type === 'fixed' ? 'border-[#FFC400] bg-[#FFF4CC] text-black' : 'border-line text-neutral-600'
                  }`}
                >
                  <RadioGroupItem value="fixed" /> ลดเป็นจำนวนเงิน (บาท)
                </label>
                <label
                  className={`flex cursor-pointer items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold transition-colors ${
                    type === 'percentage' ? 'border-[#FFC400] bg-[#FFF4CC] text-black' : 'border-line text-neutral-600'
                  }`}
                >
                  <RadioGroupItem value="percentage" /> ลดเป็นเปอร์เซ็นต์ (%)
                </label>
              </RadioGroup>
            </fieldset>

            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-sm font-bold text-black">
                  {type === 'percentage' ? 'มูลค่าส่วนลด (%) *' : 'มูลค่าส่วนลด (บาท) *'}
                </span>
                <input
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  required
                  type="number"
                  min="0"
                  step={type === 'percentage' ? '1' : '0.01'}
                  inputMode="decimal"
                  className="mt-1 h-11 w-full rounded-2xl border border-line px-3 text-sm outline-none focus:border-[#FFC400]"
                />
              </label>
              <label className="block">
                <span className="text-sm font-bold text-black">ยอดสั่งขั้นต่ำ (บาท)</span>
                <input
                  value={minOrder}
                  onChange={(e) => setMinOrder(e.target.value)}
                  type="number"
                  min="0"
                  inputMode="numeric"
                  className="mt-1 h-11 w-full rounded-2xl border border-line px-3 text-sm outline-none focus:border-[#FFC400]"
                />
              </label>
            </div>

            {type === 'percentage' && (
              <label className="block">
                <span className="text-sm font-bold text-black">ลดสูงสุดไม่เกิน (บาท)</span>
                <input
                  value={maxDiscount}
                  onChange={(e) => setMaxDiscount(e.target.value)}
                  type="number"
                  min="0"
                  inputMode="numeric"
                  placeholder="เว้นว่าง = ไม่จำกัด"
                  className="mt-1 h-11 w-full rounded-2xl border border-line px-3 text-sm outline-none focus:border-[#FFC400]"
                />
              </label>
            )}

            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-sm font-bold text-black">จำนวนครั้งที่ใช้ได้ทั้งหมด</span>
                <input
                  value={usageLimit}
                  onChange={(e) => setUsageLimit(e.target.value)}
                  type="number"
                  min="1"
                  inputMode="numeric"
                  className="mt-1 h-11 w-full rounded-2xl border border-line px-3 text-sm outline-none focus:border-[#FFC400]"
                />
              </label>
              <label className="block">
                <span className="text-sm font-bold text-black">ครั้งสูงสุดต่อลูกค้า</span>
                <input
                  value={maxPerUser}
                  onChange={(e) => setMaxPerUser(e.target.value)}
                  type="number"
                  min="1"
                  inputMode="numeric"
                  placeholder="เว้นว่าง = ไม่จำกัด"
                  className="mt-1 h-11 w-full rounded-2xl border border-line px-3 text-sm outline-none focus:border-[#FFC400]"
                />
              </label>
            </div>

            <label className="block">
              <span className="text-sm font-bold text-black">วันหมดอายุ</span>
              <input
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                type="date"
                className="mt-1 h-11 w-full rounded-2xl border border-line px-3 text-sm outline-none focus:border-[#FFC400]"
              />
            </label>

            <div className="flex items-center justify-between rounded-2xl bg-neutral-50 px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-black">เฉพาะออเดอร์แรกของลูกค้า</p>
                <p className="text-xs text-neutral-400">ใช้ได้กับลูกค้าที่ยังไม่เคยใช้คูปองนี้</p>
              </div>
              <Switch checked={firstOrderOnly} onCheckedChange={setFirstOrderOnly} aria-label="เฉพาะออเดอร์แรก" />
            </div>

            <button
              type="submit"
              disabled={saving}
              className="btn-brand flex h-12 w-full items-center justify-center gap-2 text-sm disabled:opacity-50"
            >
              <BadgePercent className="h-4 w-4" aria-hidden />
              {saving ? 'กำลังบันทึก...' : 'บันทึกการแก้ไข'}
            </button>
          </form>
        )}
      </main>

      <footer className="mt-auto border-t border-line bg-white pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-4 text-center text-xs text-neutral-400">
        © {new Date().getFullYear()} ฟู๊ด ธันเดอร์ — พอร์ทัลร้านค้า
      </footer>
    </div>
  );
}
