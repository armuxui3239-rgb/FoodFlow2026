'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, PlusCircle, Utensils } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { api, useSession } from '@/lib/client';

interface Category {
  id: string;
  name: string;
}

/** หน้าเพิ่มเมนูใหม่ — ราคาพิมพ์เป็นบาท ส่งให้ API แปลงเป็นสตางค์ */
export default function OwnerMenuNewPage() {
  const { user, ready } = useSession();
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [isAvailable, setIsAvailable] = useState(true);
  const [isPopular, setIsPopular] = useState(false);
  const [sortOrder, setSortOrder] = useState('0');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api<{ categories: Category[] }>('/api/owner/menu')
      .then((d) => setCategories(d.categories ?? []))
      .catch((e: Error) => setError(e.message));
  }, []);

  useEffect(load, [load]);

  const submit = async () => {
    setError('');
    const priceBaht = Number(price);
    if (!name.trim()) return setError('กรุณาระบุชื่อเมนู');
    if (!Number.isFinite(priceBaht) || priceBaht < 0) return setError('กรุณาระบุราคาให้ถูกต้อง');
    if (!categoryId) return setError('กรุณาเลือกหมวดหมู่');

    setSaving(true);
    try {
      await api('/api/owner/menu', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          imageUrl: imageUrl.trim() || null,
          basePriceBaht: priceBaht,
          categoryId,
          isAvailable,
          isPopular,
          sortOrder: Number(sortOrder) || 0,
        }),
      });
      router.push('/owner/menu');
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
            href="/owner/menu"
            aria-label="ย้อนกลับ"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-neutral-100 transition-transform active:scale-95"
          >
            <ArrowLeft className="h-5 w-5" aria-hidden />
          </Link>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#FFC400] text-black">
            <PlusCircle className="h-5 w-5" aria-hidden />
          </span>
          <h1 className="text-sm font-bold text-black">เพิ่มเมนูใหม่</h1>
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

        {categories.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line px-4 py-6 text-center text-sm text-neutral-500">
            ยังไม่มีหมวดหมู่ — กรุณา{' '}
            <Link href="/owner/menu/categories" className="font-bold text-black underline">
              สร้างหมวดหมู่
            </Link>{' '}
            ก่อนเพิ่มเมนู
          </p>
        ) : (
          <form
            className="space-y-4 rounded-3xl border border-line p-4"
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
          >
            <label className="block">
              <span className="text-sm font-bold text-black">ชื่อเมนู *</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                maxLength={200}
                placeholder="เช่น ข้าวมันไก่พิเศษ"
                className="mt-1 h-11 w-full rounded-2xl border border-line px-3 text-sm outline-none focus:border-[#FFC400]"
              />
            </label>

            <label className="block">
              <span className="text-sm font-bold text-black">คำอธิบาย</span>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="อธิบายเมนูสั้น ๆ"
                className="mt-1 w-full rounded-2xl border border-line px-3 py-2 text-sm outline-none focus:border-[#FFC400]"
              />
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-sm font-bold text-black">ราคา (บาท) *</span>
                <input
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  required
                  type="number"
                  min="0"
                  step="1"
                  inputMode="numeric"
                  placeholder="50"
                  className="mt-1 h-11 w-full rounded-2xl border border-line px-3 text-sm outline-none focus:border-[#FFC400]"
                />
              </label>
              <label className="block">
                <span className="text-sm font-bold text-black">ลำดับการแสดง</span>
                <input
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value)}
                  type="number"
                  inputMode="numeric"
                  className="mt-1 h-11 w-full rounded-2xl border border-line px-3 text-sm outline-none focus:border-[#FFC400]"
                />
              </label>
            </div>

            <label className="block">
              <span className="text-sm font-bold text-black">หมวดหมู่ *</span>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                required
                className="mt-1 h-11 w-full rounded-2xl border border-line bg-white px-3 text-sm outline-none focus:border-[#FFC400]"
              >
                <option value="">— เลือกหมวดหมู่ —</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-sm font-bold text-black">URL รูปภาพ</span>
              <input
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                type="url"
                placeholder="https://..."
                className="mt-1 h-11 w-full rounded-2xl border border-line px-3 text-sm outline-none focus:border-[#FFC400]"
              />
            </label>

            <div className="flex items-center justify-between rounded-2xl bg-neutral-50 px-4 py-3">
              <span className="text-sm font-semibold text-black">เปิดขายทันที</span>
              <Switch checked={isAvailable} onCheckedChange={setIsAvailable} aria-label="เปิดขายทันที" />
            </div>
            <div className="flex items-center justify-between rounded-2xl bg-neutral-50 px-4 py-3">
              <span className="text-sm font-semibold text-black">ติดแท็กเมนูยอดนิยม</span>
              <Switch checked={isPopular} onCheckedChange={setIsPopular} aria-label="เมนูยอดนิยม" />
            </div>

            <button
              type="submit"
              disabled={saving}
              className="btn-brand flex h-12 w-full items-center justify-center gap-2 text-sm disabled:opacity-50"
            >
              <Utensils className="h-4 w-4" aria-hidden />
              {saving ? 'กำลังบันทึก...' : 'บันทึกเมนู'}
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
