'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { ArrowLeft, Check, Filter, Star } from 'lucide-react';
import { api } from '@/lib/client';

const PRICE_OPTIONS = [
  { key: '$', label: 'งบน้อย ($)' },
  { key: '$$', label: 'มาตรฐาน ($$)' },
];

const RATING_OPTIONS = [
  { key: '4.5', label: '4.5 ขึ้นไป' },
  { key: '4', label: '4.0 ขึ้นไป' },
  { key: '3.5', label: '3.5 ขึ้นไป' },
];

const SORT_OPTIONS = [
  { key: 'rating', label: 'คะแนนสูงสุด' },
  { key: 'reviews', label: 'รีวิวเยอะสุด' },
  { key: 'time', label: 'เตรียมอาหารเร็ว' },
  { key: 'name', label: 'ชื่อร้าน ก–ฮ' },
];

function FiltersInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const [cuisines, setCuisines] = useState<string[]>([]);
  const [selectedCuisines, setSelectedCuisines] = useState<string[]>(() =>
    (sp.get('cuisine') ?? '').split(',').filter(Boolean),
  );
  const [prices, setPrices] = useState<string[]>(() => (sp.get('price') ?? '').split(',').filter(Boolean));
  const [rating, setRating] = useState<string | null>(() => sp.get('rating') || null);
  const [openOnly, setOpenOnly] = useState<boolean>(() => sp.get('open') === '1');
  const [sort, setSort] = useState<string>(() => sp.get('sort') || 'rating');
  const [loading, setLoading] = useState(true);

  // โหลดหมวดอาหารจริงจาก cuisine_types ของทุกร้าน
  useEffect(() => {
    api<{ data: { cuisine_types: string[] | null }[] }>('/api/restaurants')
      .then((d) => {
        const s = new Set<string>();
        d.data.forEach((r) => (r.cuisine_types ?? []).forEach((c) => c && s.add(c)));
        setCuisines(Array.from(s).sort());
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  const activeCount =
    selectedCuisines.length + prices.length + (rating ? 1 : 0) + (openOnly ? 1 : 0);

  const apply = () => {
    const qs = new URLSearchParams();
    if (selectedCuisines.length) qs.set('cuisine', selectedCuisines.join(','));
    if (prices.length) qs.set('price', prices.join(','));
    if (rating) qs.set('rating', rating);
    if (openOnly) qs.set('open', '1');
    if (sort && sort !== 'rating') qs.set('sort', sort);
    router.push(`/restaurants${qs.toString() ? `?${qs}` : ''}`);
  };

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <header className="sticky top-0 z-40 border-b border-line bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-2 px-4">
          <Link
            href="/restaurants"
            aria-label="ย้อนกลับ"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-neutral-100 transition-transform active:scale-95"
          >
            <ArrowLeft className="h-5 w-5" aria-hidden />
          </Link>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#FFC400] text-black">
            <Filter className="h-5 w-5" aria-hidden />
          </span>
          <h1 className="text-sm font-bold text-black">ตัวกรองร้านอาหาร</h1>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 space-y-5 px-4 py-5 pb-28">
        {/* เปิดเฉพาะร้านที่เปิดอยู่ */}
        <section aria-label="สถานะร้าน" className="flex items-center justify-between rounded-3xl border border-line bg-white p-4">
          <p className="text-sm font-bold text-black">เฉพาะร้านที่เปิดอยู่ตอนนี้</p>
          <button
            type="button"
            role="switch"
            aria-checked={openOnly}
            onClick={() => setOpenOnly((v) => !v)}
            data-testid="filter-open"
            className={`relative h-7 w-12 rounded-full transition-colors ${openOnly ? 'bg-black' : 'bg-neutral-200'}`}
          >
            <span
              className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${openOnly ? 'left-6 bg-[#FFC400]' : 'left-1'}`}
            />
          </button>
        </section>

        {/* หมวดประเภทอาหาร */}
        <section aria-label="ประเภทอาหาร">
          <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-neutral-400">ประเภทอาหาร</h2>
          {loading ? (
            <div className="h-16 animate-pulse rounded-3xl bg-neutral-100" />
          ) : cuisines.length === 0 ? (
            <p className="text-xs text-neutral-400">ยังไม่มีข้อมูลประเภทอาหาร</p>
          ) : (
            <div className="flex flex-wrap gap-2" role="group" aria-label="เลือกประเภทอาหาร">
              {cuisines.map((c) => {
                const active = selectedCuisines.includes(c);
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setSelectedCuisines((prev) => toggle(prev, c))}
                    aria-pressed={active}
                    className={`rounded-full px-4 py-2 text-xs font-semibold transition-all active:scale-95 ${
                      active ? 'bg-black text-[#FFC400]' : 'bg-neutral-100 text-neutral-600 hover:bg-[#FFF4CC]'
                    }`}
                  >
                    {c}
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* ช่วงราคา */}
        <section aria-label="ช่วงราคา">
          <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-neutral-400">ช่วงราคา</h2>
          <div className="flex flex-wrap gap-2" role="group" aria-label="เลือกช่วงราคา">
            {PRICE_OPTIONS.map((p) => {
              const active = prices.includes(p.key);
              return (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => setPrices((prev) => toggle(prev, p.key))}
                  aria-pressed={active}
                  className={`rounded-full px-4 py-2 text-xs font-semibold transition-all active:scale-95 ${
                    active ? 'bg-black text-[#FFC400]' : 'bg-neutral-100 text-neutral-600 hover:bg-[#FFF4CC]'
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
        </section>

        {/* คะแนนขั้นต่ำ */}
        <section aria-label="คะแนนขั้นต่ำ">
          <h2 className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-neutral-400">
            <Star className="h-3.5 w-3.5" aria-hidden /> คะแนนขั้นต่ำ
          </h2>
          <div className="flex flex-wrap gap-2" role="group" aria-label="เลือกคะแนนขั้นต่ำ">
            {RATING_OPTIONS.map((r) => {
              const active = rating === r.key;
              return (
                <button
                  key={r.key}
                  type="button"
                  onClick={() => setRating(active ? null : r.key)}
                  aria-pressed={active}
                  className={`rounded-full px-4 py-2 text-xs font-semibold transition-all active:scale-95 ${
                    active ? 'bg-black text-[#FFC400]' : 'bg-neutral-100 text-neutral-600 hover:bg-[#FFF4CC]'
                  }`}
                >
                  {r.label}
                </button>
              );
            })}
          </div>
        </section>

        {/* เรียงลำดับ */}
        <section aria-label="เรียงลำดับ">
          <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-neutral-400">เรียงลำดับผลลัพธ์</h2>
          <div className="overflow-hidden rounded-3xl border border-line bg-white">
            {SORT_OPTIONS.map((s, i) => (
              <button
                key={s.key}
                type="button"
                onClick={() => setSort(s.key)}
                aria-pressed={sort === s.key}
                className={`flex w-full items-center justify-between px-4 py-3.5 text-left text-sm font-medium text-black ${
                  i > 0 ? 'border-t border-line' : ''
                }`}
              >
                {s.label}
                {sort === s.key && <Check className="h-4.5 w-4.5 text-black" aria-label="เลือกอยู่" />}
              </button>
            ))}
          </div>
        </section>
      </main>

      {/* แถบล่าง: ล้าง + ใช้ตัวกรอง */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 px-4 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-3 backdrop-blur">
        <div className="mx-auto flex w-full max-w-5xl gap-2">
          <button
            type="button"
            onClick={() => router.push('/restaurants')}
            className="h-12 shrink-0 rounded-full border border-line bg-white px-5 text-sm font-semibold text-black"
          >
            ล้าง{activeCount > 0 ? ` (${activeCount})` : ''}
          </button>
          <button type="button" onClick={apply} data-testid="filter-apply" className="btn-brand h-12 flex-1 text-sm">
            ใช้ตัวกรอง
          </button>
        </div>
      </div>
    </div>
  );
}

/** หน้าตัวกรองร้าน (ตามแม่แบบ restaurant_filters) — ใช้ useSearchParams จึงต้องครอบด้วย Suspense */
export default function RestaurantFiltersPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-white" />}>
      <FiltersInner />
    </Suspense>
  );
}
