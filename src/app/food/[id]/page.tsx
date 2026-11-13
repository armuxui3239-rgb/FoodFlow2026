'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Check, ChevronDown, ChevronUp, Minus, Plus, Star, Utensils } from 'lucide-react';
import { api, baht } from '@/lib/client';

interface FoodData {
  item: {
    id: string;
    restaurantId: string;
    name: string;
    description: string | null;
    imageUrl: string | null;
    basePriceSatang: number;
    isAvailable: boolean;
    isPopular: boolean;
  };
  restaurant: { name: string; isOpen: boolean };
  options: {
    id: string;
    name: string;
    isRequired: boolean;
    isMultiple: boolean;
    values: { id: string; value: string; priceModifierSatang: number }[];
  }[];
}

/** หน้ารายละเอียดเมนู + ตัวเลือกเสริม (ตามแม่แบบ food_detail) — เพิ่มลงตะกร้าด้วยตัวเลือกที่เลือกจริง */
export default function FoodDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<FoodData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<Record<string, string[]>>({});
  const [qty, setQty] = useState(1);
  const [adding, setAdding] = useState(false);
  const [addDone, setAddDone] = useState(false);

  const load = useCallback(() => {
    api<FoodData>(`/api/food/${encodeURIComponent(id)}`)
      .then((d) => {
        setData(d);
        setError('');
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(load, [load]);

  const chosenValueIds = useMemo(() => Object.values(selected).flat(), [selected]);

  const unitSatang = useMemo(() => {
    if (!data) return 0;
    let sum = data.item.basePriceSatang;
    for (const opt of data.options) {
      for (const v of opt.values) {
        if (selected[opt.id]?.includes(v.id)) sum += v.priceModifierSatang;
      }
    }
    return sum;
  }, [data, selected]);

  /** ต้องเลือกครบทุกกลุ่มที่บังคับก่อน จึงกดเพิ่มลงตะกร้าได้ */
  const missingRequired = useMemo(
    () => (data?.options ?? []).filter((o) => o.isRequired && (selected[o.id]?.length ?? 0) === 0),
    [data, selected],
  );

  const toggleValue = (optionId: string, valueId: string, isMultiple: boolean) => {
    setSelected((prev) => {
      const cur = prev[optionId] ?? [];
      if (!isMultiple) return { ...prev, [optionId]: cur.includes(valueId) ? [] : [valueId] };
      return { ...prev, [optionId]: cur.includes(valueId) ? cur.filter((x) => x !== valueId) : [...cur, valueId] };
    });
  };

  const addToCart = async () => {
    if (!data || missingRequired.length > 0) return;
    setAdding(true);
    setError('');
    try {
      await api('/api/cart', {
        method: 'POST',
        body: JSON.stringify({ menuItemId: data.item.id, quantity: qty, optionValueIds: chosenValueIds }),
      });
      setAddDone(true);
      setTimeout(() => setAddDone(false), 1500);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <header className="sticky top-0 z-40 border-b border-line bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-2 px-4">
          <Link
            href={data ? `/restaurants/${data.item.restaurantId}` : '/restaurants'}
            aria-label="ย้อนกลับไปหน้าร้าน"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-neutral-100 transition-transform active:scale-95"
          >
            <ArrowLeft className="h-5 w-5" aria-hidden />
          </Link>
          <h1 className="truncate-1 text-sm font-bold text-black">{data?.item.name ?? 'รายละเอียดเมนู'}</h1>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 space-y-4 px-4 py-5 pb-36">
        {error && <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}

        {loading ? (
          <div className="space-y-3">
            <div className="h-56 animate-pulse rounded-3xl bg-neutral-100" />
            <div className="h-24 animate-pulse rounded-3xl bg-neutral-100" />
          </div>
        ) : data ? (
          <>
            {/* รูป + ชื่อ + ราคาฐาน */}
            <section aria-label="รายละเอียดเมนู">
              <div className="relative h-56 w-full overflow-hidden rounded-3xl bg-neutral-100">
                {data.item.imageUrl ? (
                  <img src={data.item.imageUrl} alt={`รูป ${data.item.name}`} className="h-full w-full object-cover" />
                ) : (
                  <span className="flex h-full w-full items-center justify-center text-neutral-300">
                    <Utensils className="h-12 w-12" aria-hidden />
                  </span>
                )}
                {data.item.isPopular && (
                  <span className="absolute left-3 top-3 rounded-full bg-[#FFC400] px-2.5 py-1 text-[11px] font-bold text-black">
                    ยอดนิยม
                  </span>
                )}
              </div>
              <div className="mt-4 space-y-1">
                <h2 className="text-xl font-bold text-black">{data.item.name}</h2>
                <p className="flex items-center gap-1.5 text-xs text-neutral-500">
                  จากร้าน{' '}
                  <Link href={`/restaurants/${data.item.restaurantId}`} className="font-bold text-black underline-offset-2 hover:underline">
                    {data.restaurant.name}
                  </Link>
                  {data.restaurant.isOpen && <span className="rounded-full bg-black px-2 py-0.5 text-[10px] font-bold text-[#FFC400]">เปิดอยู่</span>}
                </p>
                {data.item.description && <p className="pt-1 text-sm leading-relaxed text-neutral-600">{data.item.description}</p>}
                <p className="pt-1 text-lg font-bold text-black">{baht(data.item.basePriceSatang)}</p>
                {!data.item.isAvailable && (
                  <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">เมนูนี้ไม่พร้อมขายในขณะนี้</p>
                )}
              </div>
            </section>

            {/* กลุ่มตัวเลือกเสริม */}
            {data.options.map((opt) => (
              <section key={opt.id} aria-label={`ตัวเลือก ${opt.name}`} className="rounded-3xl border border-line bg-white p-4">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-bold text-black">{opt.name}</h3>
                  <span className="text-[10px] font-bold text-neutral-400">
                    {opt.isMultiple ? 'เลือกได้หลายรายการ' : 'เลือก 1 รายการ'}
                    {opt.isRequired && <span className="text-red-500"> · จำเป็น</span>}
                  </span>
                </div>
                <ul className="mt-2">
                  {opt.values.map((v) => {
                    const checked = selected[opt.id]?.includes(v.id) ?? false;
                    return (
                      <li key={v.id}>
                        <label className="flex cursor-pointer items-center gap-3 border-t border-line py-3 first:border-t-0">
                          <input
                            type={opt.isMultiple ? 'checkbox' : 'radio'}
                            name={`opt-${opt.id}`}
                            checked={checked}
                            onChange={() => toggleValue(opt.id, v.id, opt.isMultiple)}
                            className="h-4 w-4 shrink-0 accent-black"
                            aria-label={`${v.value}${v.priceModifierSatang ? ` +${baht(v.priceModifierSatang)}` : ''}`}
                          />
                          <span className="flex-1 text-sm text-black">{v.value}</span>
                          {v.priceModifierSatang !== 0 && (
                            <span className="shrink-0 text-xs font-bold text-neutral-500">
                              {v.priceModifierSatang > 0 ? '+' : ''}
                              {baht(v.priceModifierSatang)}
                            </span>
                          )}
                        </label>
                      </li>
                    );
                  })}
                  {opt.values.length === 0 && <li className="py-2 text-xs text-neutral-400">ไม่มีตัวเลือกในกลุ่มนี้</li>}
                </ul>
              </section>
            ))}
          </>
        ) : (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <Star className="h-10 w-10 text-neutral-300" aria-hidden />
            <p className="text-sm text-neutral-400">ไม่พบเมนูนี้</p>
          </div>
        )}
      </main>

      {/* แถบสั่งล่าง — จำนวน + ราคารวม + เพิ่มลงตะกร้า */}
      {data && data.item.isAvailable && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 px-4 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-3 backdrop-blur">
          <div className="mx-auto flex w-full max-w-5xl items-center gap-3">
            <div className="flex shrink-0 items-center gap-1 rounded-full bg-neutral-100 px-1" role="group" aria-label="จำนวน">
              <button
                type="button"
                onClick={() => setQty((n) => Math.max(1, n - 1))}
                disabled={qty <= 1}
                aria-label="ลดจำนวน"
                className="flex h-9 w-9 items-center justify-center rounded-full disabled:opacity-40"
              >
                <Minus className="h-4 w-4 text-black" aria-hidden />
              </button>
              <span className="w-6 text-center text-sm font-bold tabular-nums text-black">{qty}</span>
              <button
                type="button"
                onClick={() => setQty((n) => Math.min(20, n + 1))}
                aria-label="เพิ่มจำนวน"
                className="flex h-9 w-9 items-center justify-center rounded-full"
              >
                <Plus className="h-4 w-4 text-black" aria-hidden />
              </button>
            </div>
            <button
              type="button"
              onClick={() => void addToCart()}
              disabled={adding || missingRequired.length > 0}
              data-testid="food-add-cart"
              className="btn-brand flex h-12 min-w-0 flex-1 items-center justify-center gap-2 text-sm disabled:opacity-50"
            >
              {addDone ? (
                <>
                  <Check className="h-4.5 w-4.5" aria-hidden /> เพิ่มแล้ว
                </>
              ) : missingRequired.length > 0 ? (
                <>
                  <ChevronUp className="h-4 w-4" aria-hidden /> เลือก {missingRequired[0].name}
                </>
              ) : (
                <>
                  <ChevronDown className="h-4 w-4 rotate-180 opacity-0" aria-hidden /> เพิ่มลงตะกร้า · {baht(unitSatang * qty)}
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
