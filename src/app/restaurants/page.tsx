'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, Clock, MapPin, Search, Soup, Star, Utensils } from 'lucide-react';
import { api } from '@/lib/client';

interface Restaurant {
  id: string;
  name: string;
  description: string | null;
  cover_url: string | null;
  cuisine_types: string[] | null;
  rating: number | null;
  is_open: boolean;
  prep_time_avg_minutes: number | null;
  address_line: string | null;
}

/** หมวดกรองด่วย — ดึงจาก cuisine_types จริงในฐานข้อมูล */
export default function RestaurantsPage() {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [activeCat, setActiveCat] = useState<string | null>(null);

  useEffect(() => {
    api<{ data: Restaurant[] }>('/api/restaurants')
      .then((r) => setRestaurants(r.data))
      .catch(() => setRestaurants([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      api<{ data: Restaurant[] }>(`/api/restaurants${q ? `?q=${encodeURIComponent(q)}` : ''}`)
        .then((r) => setRestaurants(r.data))
        .catch(() => setRestaurants([]));
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  const cats = useMemo(() => {
    const s = new Set<string>();
    restaurants.forEach((r) => (r.cuisine_types ?? []).forEach((c) => s.add(c)));
    return Array.from(s).slice(0, 12);
  }, [restaurants]);

  const shown = useMemo(
    () => (activeCat ? restaurants.filter((r) => r.cuisine_types?.includes(activeCat)) : restaurants),
    [restaurants, activeCat],
  );

  return (
    <div className="space-y-5">
      <header className="flex items-center gap-2 pt-1">
        <Link
          href="/"
          aria-label="ย้อนกลับ"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-neutral-100 transition-transform active:scale-95"
        >
          <ChevronLeft className="h-5 w-5" aria-hidden />
        </Link>
        <h1 className="text-lg font-bold text-black">ร้านอาหารทั้งหมด</h1>
        <span className="ml-auto text-xs text-neutral-400">{loading ? 'กำลังโหลด…' : `พบ ${shown.length} ร้าน`}</span>
      </header>

      <search className="flex h-12 items-center gap-2 rounded-full bg-neutral-100 px-4">
        <Search className="h-5 w-5 shrink-0 text-neutral-400" aria-hidden />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="ค้นหาร้านอาหาร"
          aria-label="ค้นหาร้านอาหาร"
          className="h-full w-full bg-transparent text-sm outline-none placeholder:text-neutral-400"
        />
      </search>

      {cats.length > 0 && (
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1" role="group" aria-label="หมวดร้านอาหาร">
          {cats.map((c) => {
            const active = activeCat === c;
            return (
              <button
                key={c}
                onClick={() => setActiveCat(active ? null : c)}
                aria-pressed={active}
                className={`shrink-0 rounded-full px-4 py-2 text-xs font-semibold transition-all active:scale-95 ${
                  active ? 'bg-black text-[#FFC400]' : 'bg-neutral-100 text-neutral-600 hover:bg-[#FFF4CC]'
                }`}
              >
                {c}
              </button>
            );
          })}
        </div>
      )}

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-56 animate-pulse rounded-3xl bg-neutral-100" />
          ))}
        </div>
      ) : shown.length === 0 ? (
        <div className="py-16 text-center">
          <Soup className="mx-auto h-10 w-10 text-neutral-300" aria-hidden />
          <p className="mt-3 text-sm text-neutral-400">ไม่พบร้านที่ค้นหา</p>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {shown.map((r) => (
            <li key={r.id}>
              <Link
                href={`/restaurants/${r.id}`}
                className="group block overflow-hidden rounded-3xl border border-line bg-white shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="relative h-36 w-full overflow-hidden bg-neutral-100">
                  {r.cover_url ? (
                    <img
                      src={r.cover_url}
                      alt={`รูปร้าน ${r.name}`}
                      className="h-full w-full object-cover transition-transform group-hover:scale-105"
                    />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-neutral-300">
                      <Utensils className="h-9 w-9" aria-hidden />
                    </span>
                  )}
                  <span
                    className={`absolute right-3 top-3 rounded-full px-2.5 py-1 text-[11px] font-bold ${
                      r.is_open ? 'bg-black text-[#FFC400]' : 'bg-white text-neutral-500'
                    }`}
                  >
                    {r.is_open ? 'เปิดอยู่' : 'ปิดแล้ว'}
                  </span>
                </div>
                <div className="space-y-1.5 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="truncate-1 flex-1 text-base font-bold text-black">{r.name}</h2>
                    <span className="flex shrink-0 items-center gap-1 text-sm font-semibold text-black">
                      <Star className="h-4 w-4 fill-[#FFC400] stroke-black" aria-hidden />
                      {(r.rating ?? 0).toFixed(1)}
                    </span>
                  </div>
                  <p className="truncate-1 text-xs text-neutral-500">
                    {(r.cuisine_types ?? []).slice(0, 3).join(' • ') || 'อาหารอร่อย'}
                  </p>
                  <div className="flex items-center gap-3 text-xs text-neutral-500">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" aria-hidden />
                      {r.prep_time_avg_minutes ?? 20}-{(r.prep_time_avg_minutes ?? 20) + 10} นาที
                    </span>
                    {r.address_line && (
                      <span className="flex min-w-0 items-center gap-1">
                        <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
                        <span className="truncate-1">{r.address_line}</span>
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
