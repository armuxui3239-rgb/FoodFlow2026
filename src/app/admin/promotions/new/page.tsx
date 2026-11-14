'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ArrowLeft, BadgePercent, Ticket } from 'lucide-react';
import { api, useSession } from '@/lib/client';

/** หน้าสร้างคูปองใหม่ (แอดมิน) — ฟอร์มเดียวกับ POST /api/admin/promotions แล้วพาไปหน้ารายละเอียด */
export default function AdminPromotionNewPage() {
  useSession();
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    code: '',
    name: '',
    type: 'percentage',
    value: '10',
    minOrderBaht: '0',
    maxDiscountBaht: '',
    usageLimit: '500',
    expiresDays: '90',
    description: '',
  });

  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    setSaving(true);
    setError('');
    try {
      const res = await api<{ promotion: { id: string } }>('/api/admin/promotions', {
        method: 'POST',
        body: JSON.stringify({
          code: form.code.trim().toUpperCase(),
          name: form.name.trim() || `โปรโมชั่น ${form.code.trim().toUpperCase()}`,
          type: form.type,
          // fixed เก็บหน่วยสตางค์ (บาท × 100), percentage เก็บจำนวนเต็ม
          value: form.type === 'fixed' ? Math.round(Number(form.value) * 100) : Math.round(Number(form.value)),
          minOrderBaht: Number(form.minOrderBaht) || 0,
          ...(form.maxDiscountBaht ? { maxDiscountBaht: Number(form.maxDiscountBaht) } : {}),
          usageLimit: Number(form.usageLimit) || 500,
          ...(form.description.trim() ? { description: form.description.trim() } : {}),
          ...(Number(form.expiresDays)
            ? { expiresAt: new Date(Date.now() + Number(form.expiresDays) * 86400_000).toISOString() }
            : {}),
        }),
      });
      router.push(`/admin/promotions/${res.promotion.id}`);
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <header className="sticky top-0 z-40 border-b border-line bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-3xl items-center gap-2 px-4">
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
          <h1 className="text-sm font-bold text-black">สร้างคูปองใหม่</h1>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 space-y-4 px-4 py-5">
        {error && <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}

        <section className="space-y-3 rounded-3xl border border-[#FFC400] bg-[#FFF4CC] p-4" aria-label="ฟอร์มสร้างคูปอง">
          <h2 className="flex items-center gap-2 text-sm font-bold text-black"><BadgePercent className="h-4 w-4" aria-hidden /> ข้อมูลคูปอง</h2>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-neutral-500">โค้ด (ภาษาอังกฤษตัวใหญ่)</span>
              <input
                value={form.code}
                onChange={(e) => set('code')(e.target.value.toUpperCase())}
                placeholder="เช่น SONGKRAN50"
                className="h-11 w-full rounded-2xl border border-line bg-neutral-50 px-4 text-sm outline-none focus:border-[#FFC400]"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-neutral-500">ชื่อโปรโมชั่น (ไทย)</span>
              <input value={form.name} onChange={(e) => set('name')(e.target.value)} placeholder="เช่น ลด 50% สงกรานต์" className="h-11 w-full rounded-2xl border border-line bg-neutral-50 px-4 text-sm outline-none focus:border-[#FFC400]" />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-neutral-500">ประเภท</span>
              <select value={form.type} onChange={(e) => set('type')(e.target.value)} className="h-11 w-full rounded-2xl border border-line bg-neutral-50 px-3 text-sm outline-none focus:border-[#FFC400]">
                <option value="percentage">ลดเปอร์เซ็นต์ (%)</option>
                <option value="fixed">ลดเป็นจำนวนเงิน (บาท)</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-neutral-500">{form.type === 'percentage' ? 'มูลค่า (%)' : 'มูลค่า (บาท)'}</span>
              <input type="number" min={1} value={form.value} onChange={(e) => set('value')(e.target.value)} className="h-11 w-full rounded-2xl border border-line bg-neutral-50 px-4 text-sm outline-none focus:border-[#FFC400]" />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-neutral-500">ยอดขั้นต่ำ (บาท)</span>
              <input type="number" min={0} value={form.minOrderBaht} onChange={(e) => set('minOrderBaht')(e.target.value)} className="h-11 w-full rounded-2xl border border-line bg-neutral-50 px-4 text-sm outline-none focus:border-[#FFC400]" />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-neutral-500">ลดสูงสุด (บาท — สำหรับ %)</span>
              <input type="number" min={0} value={form.maxDiscountBaht} onChange={(e) => set('maxDiscountBaht')(e.target.value)} className="h-11 w-full rounded-2xl border border-line bg-neutral-50 px-4 text-sm outline-none focus:border-[#FFC400]" />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-neutral-500">จำนวนครั้งที่ใช้ได้สูงสุด</span>
              <input type="number" min={1} value={form.usageLimit} onChange={(e) => set('usageLimit')(e.target.value)} className="h-11 w-full rounded-2xl border border-line bg-neutral-50 px-4 text-sm outline-none focus:border-[#FFC400]" />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-neutral-500">มีอายุ (วัน)</span>
              <input type="number" min={1} value={form.expiresDays} onChange={(e) => set('expiresDays')(e.target.value)} className="h-11 w-full rounded-2xl border border-line bg-neutral-50 px-4 text-sm outline-none focus:border-[#FFC400]" />
            </label>
            <label className="col-span-2 block">
              <span className="mb-1 block text-xs font-semibold text-neutral-500">คำอธิบาย (ไม่บังคับ)</span>
              <textarea
                value={form.description}
                onChange={(e) => set('description')(e.target.value)}
                rows={2}
                placeholder="เงื่อนไขการใช้งานแบบสั้น ๆ"
                className="w-full rounded-2xl border border-line bg-neutral-50 px-4 py-2.5 text-sm outline-none focus:border-[#FFC400]"
              />
            </label>
          </div>
          <button
            onClick={() => void submit()}
            disabled={saving || !form.code.trim() || !form.value}
            className="btn-brand h-11 w-full text-sm disabled:opacity-50"
          >
            {saving ? 'กำลังสร้าง…' : 'สร้างคูปอง'}
          </button>
          <p className="text-[11px] text-neutral-500">เมื่อสร้างแล้ว ระบบจะพาไปหน้ารายละเอียดคูปองพร้อมสถิติการใช้งาน</p>
        </section>
      </main>

      <footer className="mt-auto border-t border-line bg-white pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-4 text-center text-xs text-neutral-400">
        © {new Date().getFullYear()} ฟู๊ด ธันเดอร์ — ศูนย์ควบคุมผู้ดูแลระบบ
      </footer>
    </div>
  );
}
