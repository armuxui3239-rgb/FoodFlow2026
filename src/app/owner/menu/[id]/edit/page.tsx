'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Pencil, Trash2, Utensils } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { api, useSession } from '@/lib/client';

interface Item {
  id: string;
  category_id: string | null;
  name: string;
  description: string | null;
  image_url: string | null;
  base_price: number;
  is_available: boolean;
  is_popular: boolean;
}

interface Category {
  id: string;
  name: string;
}

/** หน้าแก้ไขเมนู — โหลดจากรายการเมนูของร้าน แก้ด้วย PATCH และลบด้วย AlertDialog ยืนยัน */
export default function OwnerMenuEditPage() {
  const { user, ready } = useSession();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params?.id;

  const [categories, setCategories] = useState<Category[]>([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [isAvailable, setIsAvailable] = useState(true);
  const [isPopular, setIsPopular] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const [notFound, setNotFound] = useState(false);

  const load = useCallback(() => {
    if (!id) return;
    api<{ categories: Category[]; items: Item[] }>('/api/owner/menu')
      .then((d) => {
        setCategories(d.categories ?? []);
        const item = (d.items ?? []).find((x) => x.id === id);
        if (!item) {
          setNotFound(true);
          return;
        }
        setName(item.name);
        setDescription(item.description ?? '');
        setPrice(String(item.base_price / 100));
        setCategoryId(item.category_id ?? '');
        setImageUrl(item.image_url ?? '');
        setIsAvailable(item.is_available);
        setIsPopular(item.is_popular);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(load, [load]);

  const save = async () => {
    setError('');
    const priceBaht = Number(price);
    if (!name.trim()) return setError('กรุณาระบุชื่อเมนู');
    if (!Number.isFinite(priceBaht) || priceBaht < 0) return setError('กรุณาระบุราคาให้ถูกต้อง');
    if (!categoryId) return setError('กรุณาเลือกหมวดหมู่');

    setSaving(true);
    try {
      await api(`/api/owner/menu/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          imageUrl: imageUrl.trim() || null,
          basePriceBaht: priceBaht,
          categoryId,
          isAvailable,
          isPopular,
        }),
      });
      router.push('/owner/menu');
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  };

  const remove = async () => {
    setDeleting(true);
    setError('');
    try {
      await api(`/api/owner/menu/${id}`, { method: 'DELETE' });
      router.push('/owner/menu');
    } catch (e) {
      setError((e as Error).message);
      setDeleting(false);
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
            <Pencil className="h-5 w-5" aria-hidden />
          </span>
          <h1 className="min-w-0 truncate-1 text-sm font-bold text-black">แก้ไขเมนู{name ? `: ${name}` : ''}</h1>
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
            ไม่พบเมนูนี้ในร้านของคุณ
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
              <span className="text-sm font-bold text-black">ชื่อเมนู *</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                maxLength={200}
                className="mt-1 h-11 w-full rounded-2xl border border-line px-3 text-sm outline-none focus:border-[#FFC400]"
              />
            </label>

            <label className="block">
              <span className="text-sm font-bold text-black">คำอธิบาย</span>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
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
                  className="mt-1 h-11 w-full rounded-2xl border border-line px-3 text-sm outline-none focus:border-[#FFC400]"
                />
              </label>
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
            </div>

            <label className="block">
              <span className="text-sm font-bold text-black">URL รูปภาพ</span>
              <input
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                type="url"
                className="mt-1 h-11 w-full rounded-2xl border border-line px-3 text-sm outline-none focus:border-[#FFC400]"
              />
            </label>

            <div className="flex items-center justify-between rounded-2xl bg-neutral-50 px-4 py-3">
              <span className="text-sm font-semibold text-black">เปิดขาย</span>
              <Switch checked={isAvailable} onCheckedChange={setIsAvailable} aria-label="เปิดขาย" />
            </div>
            <div className="flex items-center justify-between rounded-2xl bg-neutral-50 px-4 py-3">
              <span className="text-sm font-semibold text-black">เมนูยอดนิยม</span>
              <Switch checked={isPopular} onCheckedChange={setIsPopular} aria-label="เมนูยอดนิยม" />
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={saving}
                className="btn-brand flex h-12 flex-1 items-center justify-center gap-2 text-sm disabled:opacity-50"
              >
                <Utensils className="h-4 w-4" aria-hidden />
                {saving ? 'กำลังบันทึก...' : 'บันทึกการแก้ไข'}
              </button>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <button
                    type="button"
                    disabled={deleting}
                    className="flex h-12 w-14 shrink-0 items-center justify-center rounded-2xl bg-red-50 text-red-600 transition-colors hover:bg-red-100 disabled:opacity-50"
                    aria-label="ลบเมนูนี้"
                  >
                    <Trash2 className="h-5 w-5" aria-hidden />
                  </button>
                </AlertDialogTrigger>
                <AlertDialogContent className="rounded-3xl">
                  <AlertDialogHeader>
                    <AlertDialogTitle>ลบเมนู &ldquo;{name}&rdquo;?</AlertDialogTitle>
                    <AlertDialogDescription>
                      เมื่อลบแล้วจะกู้คืนไม่ได้ ถ้าเมนูนี้เคยอยู่ในออเดอร์ระบบอาจลบไม่สำเร็จ — แนะนำให้ปิดขายแทน
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="rounded-full">ยกเลิก</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => void remove()}
                      className="rounded-full bg-red-600 text-white hover:bg-red-700"
                    >
                      ลบเมนู
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </form>
        )}
      </main>

      <footer className="mt-auto border-t border-line bg-white pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-4 text-center text-xs text-neutral-400">
        © {new Date().getFullYear()} ฟู๊ด ธันเดอร์ — พอร์ทัลร้านค้า
      </footer>
    </div>
  );
}
