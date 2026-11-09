'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, RefreshCw, Store, Utensils } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { api, baht } from '@/lib/client';

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

/** หน้าจัดการเมนูของร้าน — เปิด/ปิดขายแต่ละเมนูได้ทันที */
export default function OwnerMenuPage() {
  const [restaurantName, setRestaurantName] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setError('');
    api<{ restaurant: { name: string }; categories: Category[]; items: Item[] }>('/api/owner/menu')
      .then((d) => {
        setRestaurantName(d.restaurant.name);
        setCategories(d.categories);
        setItems(d.items);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  const toggle = async (item: Item, next: boolean) => {
    setBusyId(item.id);
    setError('');
    const prev = items;
    setItems((xs) => xs.map((x) => (x.id === item.id ? { ...x, is_available: next } : x)));
    try {
      await api('/api/owner/menu', { method: 'PATCH', body: JSON.stringify({ itemId: item.id, isAvailable: next }) });
    } catch (e) {
      setItems(prev);
      setError((e as Error).message);
    } finally {
      setBusyId(null);
    }
  };

  const soldOut = items.filter((i) => !i.is_available).length;

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <header className="sticky top-0 z-40 border-b border-line bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-2 px-4">
          <div className="flex min-w-0 items-center gap-2">
            <Link
              href="/owner"
              aria-label="ย้อนกลับ"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-neutral-100 transition-transform active:scale-95"
            >
              <ArrowLeft className="h-5 w-5" aria-hidden />
            </Link>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#FFC400] text-black">
              <Utensils className="h-5 w-5" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="truncate-1 text-sm font-bold text-black">จัดการเมนู</p>
              <p className="truncate-1 text-[11px] text-neutral-400">{restaurantName}</p>
            </div>
          </div>
          <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-neutral-100 px-3 py-1.5 text-[11px] font-bold text-neutral-600">
            <Store className="h-3.5 w-3.5" aria-hidden /> หมด {soldOut}/{items.length}
          </span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 space-y-5 px-4 py-5">
        {error && (
          <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </p>
        )}
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-20 animate-pulse rounded-3xl bg-neutral-100" />
            ))}
          </div>
        ) : (
          categories.map((cat) => {
            const catItems = items.filter((i) => i.category_id === cat.id);
            if (catItems.length === 0) return null;
            return (
              <section key={cat.id} aria-label={cat.name}>
                <h2 className="mb-2 text-sm font-bold text-black">{cat.name}</h2>
                <ul className="space-y-2">
                  {catItems.map((item) => (
                    <li key={item.id} className="flex items-center gap-3 rounded-3xl border border-line bg-white p-3 shadow-sm">
                      <div className="h-14 w-14 shrink-0 overflow-hidden rounded-2xl bg-neutral-100">
                        {item.image_url ? (
                          <img src={item.image_url} alt={`รูป ${item.name}`} className="h-full w-full object-cover" />
                        ) : (
                          <span className="flex h-full w-full items-center justify-center text-neutral-300">
                            <Utensils className="h-5 w-5" aria-hidden />
                          </span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate-1 text-sm font-bold text-black">{item.name}</p>
                        <p className="truncate-1 text-xs text-neutral-400">{item.description}</p>
                        <p className="text-sm font-bold text-black">{baht(item.base_price)}</p>
                      </div>
                      <div className="flex shrink-0 flex-col items-center gap-1">
                        <Switch
                          checked={item.is_available}
                          disabled={busyId === item.id}
                          onCheckedChange={(v) => void toggle(item, v)}
                          aria-label={`${item.is_available ? 'ปิดขาย' : 'เปิดขาย'} ${item.name}`}
                        />
                        <span className={`text-[10px] font-bold ${item.is_available ? 'text-black' : 'text-neutral-400'}`}>
                          {item.is_available ? 'ขายอยู่' : 'หมด'}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })
        )}
      </main>

      <footer className="mt-auto border-t border-line bg-white pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-4 text-center text-xs text-neutral-400">
        © {new Date().getFullYear()} ฟู๊ด ธันเดอร์ — พอร์ทัลร้านค้า
      </footer>
    </div>
  );
}
