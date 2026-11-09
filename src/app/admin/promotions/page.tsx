'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, BadgePercent, Plus, Ticket } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { api, baht } from '@/lib/client';

interface PromoRow {
  id: string;
  code: string;
  name: string;
  type: string;
  value: number;
  min_order_amount: number;
  max_discount: number | null;
  usage_count: number;
  usage_limit: number | null;
  expires_at: string | null;
  is_active: boolean;
}

/** หน้าจัดการคูปอง (แอดมิน) — เปิด/ปิด + สร้างโค้ดใหม่จริง */
export default function AdminPromotionsPage() {
  const [rows, setRows] = useState<PromoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ code: '', name: '', type: 'percentage', value: '10', minOrderBaht: '0', maxDiscountBaht: '' });

  const load = useCallback(() => {
    api<{ data: PromoRow[] }>('/api/admin/promotions')
      .then((d) => setRows(d.data))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  const toggle = async (p: PromoRow, next: boolean) => {
    setBusyId(p.id);
    setError('');
    try {
      await api('/api/admin/promotions', { method: 'PATCH', body: JSON.stringify({ id: p.id, isActive: next }) });
      setRows((rs) => rs.map((r) => (r.id === p.id ? { ...r, is_active: next } : r)));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyId(null);
    }
  };

  const create = async () => {
    setSaving(true);
    setError('');
    try {
      await api('/api/admin/promotions', {
        method: 'POST',
        body: JSON.stringify({
          code: form.code.trim().toUpperCase(),
          name: form.name,
          type: form.type,
          value: Number(form.value),
          minOrderBaht: Number(form.minOrderBaht) || 0,
          ...(form.maxDiscountBaht ? { maxDiscountBaht: Number(form.maxDiscountBaht) } : {}),
        }),
      });
      setShowForm(false);
      setForm({ code: '', name: '', type: 'percentage', value: '10', minOrderBaht: '0', maxDiscountBaht: '' });
      setLoading(true);
      load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <header className="sticky top-0 z-40 border-b border-line bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-2 px-4">
          <div className="flex min-w-0 items-center gap-2">
            <Link
              href="/admin"
              aria-label="ย้อนกลับ"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-neutral-100 transition-transform active:scale-95"
            >
              <ArrowLeft className="h-5 w-5" aria-hidden />
            </Link>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-black text-[#FFC400]">
              <Ticket className="h-5 w-5" aria-hidden />
            </span>
            <h1 className="text-sm font-bold text-black">จัดการคูปอง ({rows.length})</h1>
          </div>
          <button
            onClick={() => setShowForm((s) => !s)}
            className="btn-brand flex h-10 items-center gap-1.5 px-4 text-xs"
          >
            <Plus className="h-4 w-4" aria-hidden /> สร้างโค้ด
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 space-y-4 px-4 py-5">
        {error && <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}

        {/* ฟอร์มสร้างคูปองใหม่ */}
        {showForm && (
          <section className="space-y-3 rounded-3xl border border-[#FFC400] bg-[#FFF4CC] p-4" aria-label="สร้างคูปองใหม่">
            <h2 className="flex items-center gap-2 text-sm font-bold text-black"><BadgePercent className="h-4 w-4" aria-hidden /> สร้างคูปองใหม่</h2>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-neutral-500">โค้ด (ภาษาอังกฤษตัวใหญ่)</span>
                <input value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))} placeholder="เช่น SONGKRAN50" className="h-11 w-full rounded-2xl border border-line bg-white px-4 text-sm outline-none focus:border-black" />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-neutral-500">ชื่อโปรโมชั่น (ไทย)</span>
                <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="เช่น ลด 50% สงกรานต์" className="h-11 w-full rounded-2xl border border-line bg-white px-4 text-sm outline-none focus:border-black" />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-neutral-500">ประเภท</span>
                <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))} className="h-11 w-full rounded-2xl border border-line bg-white px-3 text-sm outline-none focus:border-black">
                  <option value="percentage">ลดเปอร์เซ็นต์ (%)</option>
                  <option value="fixed">ลดเป็นจำนวนเงิน (บาท)</option>
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-neutral-500">{form.type === 'percentage' ? 'มูลค่า (%)' : 'มูลค่า (บาท)'}</span>
                <input type="number" min={1} value={form.value} onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))} className="h-11 w-full rounded-2xl border border-line bg-white px-4 text-sm outline-none focus:border-black" />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-neutral-500">ยอดขั้นต่ำ (บาท)</span>
                <input type="number" min={0} value={form.minOrderBaht} onChange={(e) => setForm((f) => ({ ...f, minOrderBaht: e.target.value }))} className="h-11 w-full rounded-2xl border border-line bg-white px-4 text-sm outline-none focus:border-black" />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-neutral-500">ลดสูงสุด (บาท — สำหรับ %)</span>
                <input type="number" min={0} value={form.maxDiscountBaht} onChange={(e) => setForm((f) => ({ ...f, maxDiscountBaht: e.target.value }))} className="h-11 w-full rounded-2xl border border-line bg-white px-4 text-sm outline-none focus:border-black" />
              </label>
            </div>
            <button onClick={() => void create()} disabled={saving || !form.code.trim()} className="btn-brand h-11 w-full text-sm disabled:opacity-50">
              {saving ? 'กำลังสร้าง…' : 'สร้างคูปอง'}
            </button>
          </section>
        )}

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-3xl bg-neutral-100" />
            ))}
          </div>
        ) : (
          <ul className="overflow-hidden rounded-3xl border border-line bg-white">
            {rows.map((p, i) => (
              <li key={p.id} className={`flex items-center gap-3 px-4 py-3 ${i > 0 ? 'border-t border-line' : ''}`}>
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#FFF4CC]">
                  <Ticket className="h-4 w-4 text-black" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate-1 text-sm font-bold text-black">
                    {p.code} · {p.name}
                  </p>
                  <p className="truncate-1 text-[11px] text-neutral-400">
                    {p.type === 'percentage' ? `ลด ${p.value}%` : `ลด ${baht(p.value)}`} · ขั้นต่ำ {baht(p.min_order_amount)}
                    {p.max_discount ? ` · สูงสุด ${baht(p.max_discount)}` : ''}
                    {` · ใช้แล้ว ${p.usage_count}${p.usage_limit ? `/${p.usage_limit}` : ''} ครั้ง`}
                  </p>
                </div>
                <Switch
                  checked={p.is_active}
                  disabled={busyId === p.id}
                  onCheckedChange={(v) => void toggle(p, v)}
                  aria-label={`${p.is_active ? 'ปิด' : 'เปิด'} คูปอง ${p.code}`}
                />
              </li>
            ))}
          </ul>
        )}
      </main>

      <footer className="mt-auto border-t border-line bg-white pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-4 text-center text-xs text-neutral-400">
        © {new Date().getFullYear()} ฟู๊ด ธันเดอร์ — ศูนย์ควบคุมผู้ดูแลระบบ
      </footer>
    </div>
  );
}
