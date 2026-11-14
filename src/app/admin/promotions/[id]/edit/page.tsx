'use client';

import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { Ticket } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { api } from '@/lib/client';
import { AdminSubShell } from '@/components/portal/admin-header';

interface PromoRow {
  id: string;
  code: string;
  name: string;
  description: string | null;
  type: string;
  value: number;
  min_order_amount: number;
  max_discount: number | null;
  usage_limit: number | null;
  max_per_user: number | null;
  first_order_only: boolean;
  starts_at: string | null;
  expires_at: string | null;
  is_active: boolean;
}

/** ISO → ค่าที่ input datetime-local รับ (เวลาท้องถิ่น) */
function isoToLocalInput(iso: string | null): string {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  return new Date(t - new Date(t).getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

/** datetime-local → ISO (เว้นว่างคืน null) */
function localToIso(v: string): string | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

const inputCls =
  'h-11 w-full rounded-2xl border border-line bg-neutral-50 px-4 text-sm text-black outline-none focus:border-[#FFC400]';
const labelCls = 'mb-1 block text-xs font-semibold text-neutral-500';

/** หน้าแก้ไขโปรโมชั่น — ดึงค่าเดิมมาเติมฟอร์ม แล้วบันทึกด้วย PATCH */
export default function AdminPromotionEditPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [code, setCode] = useState('');
  const [form, setForm] = useState({
    name: '',
    description: '',
    type: 'percent' as 'percent' | 'fixed',
    value: '10',
    minOrderBaht: '0',
    maxDiscountBaht: '',
    usageLimit: '',
    maxPerUser: '',
    firstOrderOnly: false,
    startsAt: '',
    expiresAt: '',
    isActive: true,
  });

  const load = useCallback(() => {
    setLoading(true);
    // API ฝั่ง A คืน { promotion, usages, stats } — ใช้ promotion สำหรับเติมฟอร์ม
    api<{ promotion: PromoRow }>(`/api/admin/promotions/${id}`)
      .then((r) => {
        const p = r.promotion;
        setCode(p.code);
        setForm({
          name: p.name,
          description: p.description ?? '',
          type: p.type === 'fixed' ? 'fixed' : 'percent',
          value: p.type === 'fixed' ? String(p.value / 100) : String(p.value), // ลดคงที่เก็บหน่วยสตางค์ → แสดงเป็นบาท
          minOrderBaht: String(p.min_order_amount / 100),
          maxDiscountBaht: p.max_discount != null ? String(p.max_discount / 100) : '',
          usageLimit: p.usage_limit != null ? String(p.usage_limit) : '',
          maxPerUser: p.max_per_user != null ? String(p.max_per_user) : '',
          firstOrderOnly: p.first_order_only,
          startsAt: isoToLocalInput(p.starts_at),
          expiresAt: isoToLocalInput(p.expires_at),
          isActive: p.is_active,
        });
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!id) return;
    const t = setTimeout(load, 0); // หน่วงออกจาก effect body กัน cascading render
    return () => clearTimeout(t);
  }, [id, load]);

  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  const submit = async () => {
    setError('');
    const valueNum = Number(form.value);
    if (!form.name.trim()) return setError('กรุณากรอกชื่อโปรโมชั่น');
    if (!Number.isFinite(valueNum) || valueNum <= 0) return setError('กรุณากรอกมูลค่าส่วนลดให้ถูกต้อง');
    if (form.type === 'percent' && (!Number.isInteger(valueNum) || valueNum < 1 || valueNum > 100)) {
      return setError('ส่วนลดเปอร์เซ็นต์ต้องเป็นจำนวนเต็ม 1-100');
    }
    setSaving(true);
    try {
      // API ฝั่ง A รับคีย์แบบ camelCase และ type เป็น percentage|fixed
      // value ของ fixed ต้องเป็นสตางค์ (บาท × 100), เปอร์เซ็นต์เป็นจำนวนเต็ม 1-100
      await api(`/api/admin/promotions/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: form.name.trim(),
          description: form.description.trim() || null,
          type: form.type === 'fixed' ? 'fixed' : 'percentage',
          value: form.type === 'fixed' ? Math.round(valueNum * 100) : Math.round(valueNum),
          minOrderBaht: Number(form.minOrderBaht) || 0,
          maxDiscountBaht: form.maxDiscountBaht ? Number(form.maxDiscountBaht) : null,
          usageLimit: form.usageLimit ? Number(form.usageLimit) : null,
          expiresAt: localToIso(form.expiresAt),
          isActive: form.isActive,
        }),
      });
      router.push('/admin/promotions');
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  };

  return (
    <AdminSubShell title={`แก้ไขโปรโมชั่น${code ? ` · ${code}` : ''}`} subtitle="คูปองระดับแพลตฟอร์ม" backHref="/admin/promotions" Icon={Ticket}>
      {error && (
        <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </p>
      )}

      {loading ? (
        <div className="space-y-3">
          <div className="h-16 animate-pulse rounded-3xl bg-neutral-100" />
          <div className="h-64 animate-pulse rounded-3xl bg-neutral-100" />
        </div>
      ) : (
        <section aria-label="ฟอร์มแก้ไขโปรโมชั่น" className="space-y-3 rounded-3xl border border-line bg-white p-4 shadow-sm">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className={labelCls}>โค้ด (แก้ไขไม่ได้)</span>
              <input value={code} disabled className={`${inputCls} bg-neutral-50 text-neutral-400`} />
            </label>
            <label className="block">
              <span className={labelCls}>ชื่อโปรโมชั่น</span>
              <input value={form.name} onChange={(e) => set({ name: e.target.value })} className={inputCls} />
            </label>
          </div>

          <label className="block">
            <span className={labelCls}>คำอธิบาย</span>
            <textarea value={form.description} onChange={(e) => set({ description: e.target.value })} rows={2} className="w-full rounded-2xl border border-line bg-neutral-50 px-4 py-3 text-sm text-black outline-none focus:border-[#FFC400]" />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className={labelCls}>ประเภทส่วนลด</span>
              <select value={form.type} onChange={(e) => set({ type: e.target.value === 'fixed' ? 'fixed' : 'percent' })} className={inputCls}>
                <option value="percent">เปอร์เซ็นต์ (%)</option>
                <option value="fixed">ลดคงที่ (บาท)</option>
              </select>
            </label>
            <label className="block">
              <span className={labelCls}>{form.type === 'percent' ? 'มูลค่า (1-100)' : 'มูลค่า (บาท)'}</span>
              <input type="number" min={form.type === 'percent' ? 1 : 0} max={form.type === 'percent' ? 100 : undefined} value={form.value} onChange={(e) => set({ value: e.target.value })} className={inputCls} />
            </label>
            <label className="block">
              <span className={labelCls}>ยอดสั่งขั้นต่ำ (บาท)</span>
              <input type="number" min={0} value={form.minOrderBaht} onChange={(e) => set({ minOrderBaht: e.target.value })} className={inputCls} />
            </label>
            <label className="block">
              <span className={labelCls}>ลดสูงสุด (บาท — สำหรับเปอร์เซ็นต์)</span>
              <input type="number" min={0} value={form.maxDiscountBaht} onChange={(e) => set({ maxDiscountBaht: e.target.value })} className={inputCls} />
            </label>
            <label className="block">
              <span className={labelCls}>จำนวนครั้งที่ใช้ได้ทั้งหมด</span>
              <input type="number" min={1} value={form.usageLimit} onChange={(e) => set({ usageLimit: e.target.value })} className={inputCls} />
            </label>
            <label className="block">
              <span className={labelCls}>จำนวนครั้งสูงสุดต่อผู้ใช้ (แก้ไขผ่านฐานข้อมูลเท่านั้น)</span>
              <input value={form.maxPerUser} disabled className={`${inputCls} bg-neutral-50 text-neutral-400`} />
            </label>
            <label className="block">
              <span className={labelCls}>หมดอายุ</span>
              <input type="datetime-local" value={form.expiresAt} onChange={(e) => set({ expiresAt: e.target.value })} className={inputCls} />
            </label>
          </div>

          <div className="flex items-center justify-between rounded-2xl bg-neutral-50 px-4 py-3">
            <span className="text-sm font-semibold text-black">เปิดใช้งาน</span>
            <Switch checked={form.isActive} onCheckedChange={(v) => set({ isActive: v })} aria-label="เปิดใช้งาน" />
          </div>

          <button onClick={() => void submit()} disabled={saving} className="btn-brand h-12 w-full text-sm disabled:opacity-50">
            {saving ? 'กำลังบันทึก…' : 'บันทึกการแก้ไข'}
          </button>
        </section>
      )}
    </AdminSubShell>
  );
}
