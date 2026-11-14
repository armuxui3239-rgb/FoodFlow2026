'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Check, ChevronDown, Bird, Clock, Drumstick, Fish, Flame, MapPin, Pizza, Plus, Salad, Sandwich, Search, SlidersHorizontal, Soup, Sparkles, Star, Utensils } from 'lucide-react';
import { BrandLogo } from '@/components/brand-logo';
import type { LucideIcon } from 'lucide-react';
// ไอคอนทั้งหมดมาจากไฟล์ SVG (lucide-react) ห้ามใช้อีโมจิ
import { api, baht, useCart, useSession } from '@/lib/client';

interface Restaurant {
  id: string;
  name: string;
  description: string | null;
  cover_url: string | null;
  logo_url: string | null;
  address_line: string | null;
  cuisine_types: string[] | null;
  price_range: string | null;
  rating: number | null;
  is_open: boolean;
  prep_time_avg_minutes: number | null;
}

interface PopularItem {
  id: string;
  name: string;
  image_url: string | null;
  base_price: number;
  restaurant_id: string;
  restaurant_name: string;
}

/** หมวดยอดนิยม — ไอคอนจากไฟล์ SVG (lucide-react) ตามกฎห้ามใช้อีโมจิ (แสดงบนหน้าแรก 8 วงกลมตาม FoodU) */
const CATS: { name: string; Icon: LucideIcon }[] = [
  { name: 'อาหารไทย', Icon: Soup },
  { name: 'ก๋วยเตี๋ยว', Icon: Utensils },
  { name: 'ส้มตำ', Icon: Salad },
  { name: 'ข้าวมันไก่', Icon: Drumstick },
  { name: 'ซูชิ', Icon: Fish },
  { name: 'พิซซ่า', Icon: Pizza },
  { name: 'ไก่ทอด', Icon: Bird },
  { name: 'ฟาสต์ฟู้ด', Icon: Sandwich },
];

/** รูปประกอบการ์ดโปรโมชั่น — เลือกจากไฟล์ที่มีใน /public/food ตามลำดับ (การ์ด UI ไม่ใช่ข้อมูลส่วนลด) */
const OFFER_IMGS = [
  '/food/boat-noodle.png',
  '/food/som-tam.png',
  '/food/fried-chicken.png',
  '/food/tom-yum.png',
  '/food/pad-thai.png',
  '/food/khao-mun-kai.png',
  '/food/sushi.png',
  '/food/pizza.png',
];

interface OfferRow {
  id: string;
  code: string;
  type: string;
  value: number | null;
  name: string;
}

interface OfferCard {
  pct: string;
  title: string;
  code: string;
  dark: boolean;
  img: string;
}

/** ป้ายเปอร์เซ็นต์/จำนวนเงินจากข้อมูลจริงในตาราง promotions (เงินเป็นสตางค์) */
function offerLabel(p: OfferRow): string {
  if (p.type === 'percentage' || p.type === 'percent') return `ลด ${p.value ?? 0}%`;
  if (p.type === 'fixed') return `ลด ฿${((p.value ?? 0) / 100).toLocaleString('th-TH')}`;
  return 'ฟรีค่าส่ง';
}

function toOfferCard(p: OfferRow, i: number): OfferCard {
  return {
    pct: offerLabel(p),
    title: p.name?.trim() || 'โปรโมชั่นพิเศษ',
    code: p.code,
    dark: i % 2 === 0,
    img: OFFER_IMGS[i % OFFER_IMGS.length],
  };
}

export default function HomePage() {
  const { user } = useSession();
  const { refresh: refreshCart } = useCart();
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [popular, setPopular] = useState<PopularItem[]>([]);
  const [offers, setOffers] = useState<OfferCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [added, setAdded] = useState<string | null>(null);

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

  useEffect(() => {
    api<{ data: PopularItem[] }>('/api/menu/popular')
      .then((r) => setPopular(r.data))
      .catch(() => setPopular([]));
  }, []);

  // โปรโมชั่นจากตาราง promotions จริง (ห้าม hard-code โค้ด/ส่วนลดในหน้าเว็บ)
  useEffect(() => {
    api<{ data: OfferRow[] }>('/api/promotions')
      .then((r) => setOffers((r.data ?? []).slice(0, 6).map(toOfferCard)))
      .catch(() => setOffers([]));
  }, []);

  const shown = useMemo(
    () => (activeCat ? restaurants.filter((r) => r.cuisine_types?.includes(activeCat)) : restaurants),
    [restaurants, activeCat],
  );

  const firstName = user?.fullName ? user.fullName.split(' ')[0] : 'นักชิม';

  const quickAdd = async (itemId: string) => {
    try {
      await api('/api/cart', {
        method: 'POST',
        body: JSON.stringify({ menuItemId: itemId, quantity: 1 }),
      });
      await refreshCart();
      setAdded(itemId);
      setTimeout(() => setAdded(null), 1200);
    } catch {
      /* 401 → redirect อัตโนมัติ */
    }
  };

  return (
    <div className="space-y-6">
      {/* 1) หัวทักทาย — ตาม FoodU: avatar + สวัสดี + ส่งถึง */}
      <header className="flex items-center gap-3 pt-1">
        {user ? (
          <span
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-black text-xl text-[#FFC400]"
            aria-hidden
          >
            {firstName.slice(0, 1)}
          </span>
        ) : (
          <BrandLogo className="h-12 w-12 shrink-0 rounded-full" />
        )}
        <div className="min-w-0 flex-1">
          <h1 className="truncate-1 text-lg font-bold text-black">
            สวัสดี, {firstName}
          </h1>
          <p className="flex items-center gap-1 text-xs text-neutral-500">
            <span className="h-2 w-2 shrink-0 rounded-full bg-[#FFC400] ring-2 ring-black/5" aria-hidden />
            <span className="truncate-1">ส่งถึง: กรุงเทพมหานคร</span>
            <ChevronDown className="h-3.5 w-3.5 shrink-0" aria-hidden />
          </p>
        </div>
      </header>

      {/* 2) ค้นหา + ปุ่มกรอง */}
      <search className="flex items-center gap-3">
        <div className="flex h-12 flex-1 items-center gap-2 rounded-full bg-neutral-100 px-4">
          <Search className="h-5 w-5 shrink-0 text-neutral-400" aria-hidden />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="ค้นหาร้านหรือเมนูอาหาร"
            aria-label="ค้นหาร้านหรือเมนูอาหาร"
            className="h-full w-full bg-transparent text-sm outline-none placeholder:text-neutral-400"
          />
        </div>
        <button
          type="button"
          aria-label="ตัวกรองการค้นหา"
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-black text-[#FFC400] transition-transform active:scale-95"
        >
          <SlidersHorizontal className="h-5 w-5" aria-hidden />
        </button>
      </search>

      {/* 3) ข้อเสนอพิเศษ — การ์ดโปรโมชั่นเลื่อนได้ (ข้อมูลจริงจากตาราง promotions) */}
      {offers.length > 0 ? (
      <section aria-label="ข้อเสนอพิเศษ">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-bold text-black">ข้อเสนอพิเศษ <Flame className="inline h-4 w-4 text-[#FFC400]" aria-hidden /></h2>
          <Link href="/offers" className="text-xs font-medium text-neutral-400">ดูทั้งหมด</Link>
        </div>
        <div className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1">
          {offers.map((o) => (
            <article
              key={o.code}
              className={`relative flex h-32 w-[85%] shrink-0 snap-start items-center justify-between overflow-hidden rounded-3xl p-4 ${
                o.dark ? 'bg-black text-white' : 'bg-[#FFC400] text-black'
              }`}
            >
              <div className="min-w-0 space-y-1.5">
                <p className={`truncate-1 text-2xl font-bold ${o.dark ? 'text-[#FFC400]' : 'text-black'}`}>
                  {o.pct}
                </p>
                <p className="truncate-1 text-xs opacity-80">{o.title}</p>
                <span
                  className={`inline-block rounded-full px-2.5 py-1 text-[10px] font-bold ${
                    o.dark ? 'bg-[#FFC400] text-black' : 'bg-black text-[#FFC400]'
                  }`}
                >
                  โค้ด {o.code}
                </span>
              </div>
              <div
                className={`h-24 w-24 shrink-0 overflow-hidden rounded-full ring-4 ${
                  o.dark ? 'ring-[#FFC400]/30' : 'ring-black/10'
                }`}
                aria-hidden
              >
                <img src={o.img} alt="" className="h-full w-full object-cover" />
              </div>
              <span
                className="pointer-events-none absolute -bottom-8 -right-8 h-24 w-24 rounded-full opacity-20"
                style={{ background: o.dark ? '#FFC400' : '#ffffff' }}
                aria-hidden
              />
            </article>
          ))}
        </div>
      </section>
      ) : null}

      {/* 4) แนะนำสำหรับคุณ — การ์ดอาหารเลื่อนแนวนอน */}
      {popular.length > 0 && (
        <section aria-label="แนะนำสำหรับคุณ">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-bold text-black">แนะนำสำหรับคุณ <Sparkles className="inline h-4 w-4 text-[#FFC400]" aria-hidden /></h2>
            <span className="text-xs font-medium text-neutral-400">ดูทั้งหมด</span>
          </div>
          <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-1">
            {popular.slice(0, 8).map((p) => (
              <div
                key={p.id}
                className="w-36 shrink-0 rounded-3xl border border-line bg-white p-2.5 shadow-sm transition-shadow hover:shadow-md"
              >
                <Link href={`/restaurants/${p.restaurant_id}`} className="block">
                  <div className="h-24 w-full overflow-hidden rounded-2xl bg-neutral-100">
                    {p.image_url ? (
                      <img src={p.image_url} alt={`รูป ${p.name}`} className="h-full w-full object-cover" />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center text-neutral-300">
                        <Utensils className="h-8 w-8" aria-hidden />
                      </span>
                    )}
                  </div>
                  <h3 className="truncate-1 mt-2 text-sm font-bold text-black">{p.name}</h3>
                  <p className="truncate-1 text-[11px] text-neutral-400">{p.restaurant_name}</p>
                </Link>
                <div className="mt-1 flex items-center justify-between">
                  <span className="text-sm font-bold text-black">{baht(p.base_price)}</span>
                  <button
                    onClick={() => void quickAdd(p.id)}
                    aria-label={`เพิ่ม ${p.name} ลงตะกร้า`}
                    className={`flex h-7 w-7 items-center justify-center rounded-full transition-all active:scale-90 ${
                      added === p.id ? 'bg-black text-[#FFC400]' : 'btn-brand'
                    }`}
                  >
                    {added === p.id ? <Check className="h-3.5 w-3.5" aria-hidden /> : <Plus className="h-3.5 w-3.5" aria-hidden />}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 5) หมวดหมู่เมนู — วงกลม 4 คอลัมน์ */}
      <section aria-label="หมวดหมู่เมนู">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-bold text-black">หมวดหมู่เมนู</h2>
          {activeCat && (
            <button onClick={() => setActiveCat(null)} className="text-xs font-medium text-neutral-400">
              ล้างตัวเลือก
            </button>
          )}
        </div>
        <ul className="grid grid-cols-4 gap-x-1.5 gap-y-4" role="group">
          {CATS.map((c) => {
            const active = activeCat === c.name;
            return (
              <li key={c.name} className="flex flex-col items-center gap-1.5">
                <button
                  onClick={() => setActiveCat(active ? null : c.name)}
                  aria-pressed={active}
                  aria-label={`หมวด ${c.name}`}
                  className={`flex h-16 w-16 items-center justify-center rounded-full text-2xl transition-all active:scale-95 ${
                    active
                      ? 'bg-black ring-2 ring-[#FFC400] ring-offset-2'
                      : 'bg-neutral-100 hover:bg-[#FFF4CC]'
                  }`}
                >
                  <c.Icon className="h-7 w-7 text-black" aria-hidden />
                </button>
                <span
                  className={`w-full truncate-1 text-center text-[10px] leading-tight ${
                    active ? 'font-bold text-black' : 'text-neutral-500'
                  }`}
                >
                  {c.name}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      {/* 6) ร้านใกล้คุณ — รายการร้าน */}
      <section aria-label="ร้านใกล้คุณ">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-bold text-black">ร้านใกล้คุณ</h2>
          <span className="text-xs text-neutral-400">พบ {shown.length} ร้าน</span>
        </div>
        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-56 animate-pulse rounded-3xl bg-neutral-100" />
            ))}
          </div>
        ) : shown.length === 0 ? (
          <p className="py-12 text-center text-sm text-neutral-400">ไม่พบร้านที่ค้นหา</p>
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
                        <Soup className="h-9 w-9" aria-hidden />
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
                      <h3 className="truncate-1 flex-1 text-base font-bold text-black">{r.name}</h3>
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
      </section>
    </div>
  );
}
