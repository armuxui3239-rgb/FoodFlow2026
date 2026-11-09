'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, ChevronLeft, Clock, Heart, MapPin, MessageCircle, Minus, Plus, Soup, Star, Utensils } from 'lucide-react';
import { api, baht, useCart, useSession } from '@/lib/client';

interface Category {
  id: string;
  name: string;
}
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
interface Restaurant {
  id: string;
  name: string;
  description: string | null;
  cover_url: string | null;
  address_line: string | null;
  cuisine_types: string[] | null;
  rating: number | null;
  total_reviews: number | null;
  is_open: boolean;
  prep_time_avg_minutes: number | null;
  min_order_amount: number | null;
}
interface ReviewItem {
  id: string;
  food_rating: number;
  delivery_rating: number;
  comment: string | null;
  createdAt: string;
  reply: string | null;
  replyAt: string | null;
  customerName: string;
}
interface ReviewsData {
  average: number;
  count: number;
  reviews: ReviewItem[];
}

/** ดาว 5 ดวงสำหรับแสดงคะแนน */
function ReviewStars({ value }: { value: number }) {
  return (
    <span className="flex shrink-0 items-center gap-0.5" aria-label={`คะแนน ${value} จาก 5 ดวง`}>
      {[0, 1, 2, 3, 4].map((i) => (
        <Star
          key={i}
          className={`h-4 w-4 ${i < value ? 'fill-[#FFC400] stroke-[#FFC400]' : 'fill-none stroke-neutral-300'}`}
          aria-hidden
        />
      ))}
    </span>
  );
}

export default function RestaurantPage() {
  const { id } = useParams<{ id: string }>();
  const { refresh } = useCart();
  const { user } = useSession();
  const [isFav, setIsFav] = useState(false);
  const [favBusy, setFavBusy] = useState(false);
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  // ใช้ UUID จริงของร้าน (เมื่อเข้าด้วย slug เช่น ft-1 จะได้ id จาก API) — ใช้กับ favorites/cart
  const rid = restaurant?.id ?? id;
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [activeCat, setActiveCat] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [adding, setAdding] = useState<string | null>(null);
  const [added, setAdded] = useState<string | null>(null);
  const [reviewsData, setReviewsData] = useState<ReviewsData | null>(null);
  const [reviewsLoading, setReviewsLoading] = useState(true);
  const [reviewsError, setReviewsError] = useState('');

  useEffect(() => {
    api<{ restaurant: Restaurant; categories: Category[]; items: Item[] }>(`/api/restaurants/${id}`)
      .then((d) => {
        setRestaurant(d.restaurant);
        setCategories(d.categories);
        setItems(d.items);
        setActiveCat('all');
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  // รีวิวร้าน — โหลดแยกจากเมนู กันกระทบการโหลดหลัก
  const loadReviews = useCallback(() => {
    setReviewsLoading(true);
    setReviewsError('');
    api<{ data: ReviewsData }>(`/api/restaurants/${id}/reviews`)
      .then((r) => setReviewsData(r.data))
      .catch((e: Error) => setReviewsError(e.message))
      .finally(() => setReviewsLoading(false));
  }, [id]);

  useEffect(() => {
    loadReviews();
  }, [loadReviews]);

  // โหลดสถานะร้านโปรดของผู้ใช้ (ถ้าเข้าสู่ระบบ) — ไม่บล็อกการโหลดร้านหลัก
  useEffect(() => {
    if (!user || !rid) return;
    let cancelled = false;
    api<{ data: { restaurant_id: string }[] }>('/api/favorites')
      .then((r) => {
        if (!cancelled) setIsFav(r.data.some((f) => f.restaurant_id === rid));
      })
      .catch(() => {
        /* 401 → ยังไม่เข้าสู่ระบบ ปล่อยเป็น false */
      });
    return () => {
      cancelled = true;
    };
  }, [user, rid]);

  const toggleFav = async () => {
    if (!user || favBusy || !rid) return;
    setFavBusy(true);
    try {
      if (isFav) {
        await api(`/api/favorites?restaurantId=${rid}`, { method: 'DELETE' });
        setIsFav(false);
      } else {
        await api('/api/favorites', { method: 'POST', body: JSON.stringify({ restaurantId: rid }) });
        setIsFav(true);
      }
    } catch {
      /* api() จะพาไป /login เองเมื่อ 401 */
    } finally {
      setFavBusy(false);
    }
  };

  const shown = useMemo(
    () => (activeCat === 'all' ? items : items.filter((i) => i.category_id === activeCat)),
    [items, activeCat],
  );

  const addToCart = async (itemId: string) => {
    setAdding(itemId);
    try {
      await api('/api/cart', {
        method: 'POST',
        body: JSON.stringify({ menuItemId: itemId, quantity: 1 }),
      });
      await refresh();
      setAdded(itemId);
      setTimeout(() => setAdded(null), 1200);
    } catch {
      /* 401 → redirect อัตโนมัติ */
    } finally {
      setAdding(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="-mx-4 -mt-4 h-56 animate-pulse bg-neutral-100" />
        <div className="h-8 w-48 animate-pulse rounded-2xl bg-neutral-100" />
        <div className="h-64 animate-pulse rounded-3xl bg-neutral-100" />
      </div>
    );
  }
  if (error || !restaurant) {
    return (
      <div className="py-16 text-center">
        <p className="text-sm text-red-500">{error || 'ไม่พบร้านอาหาร'}</p>
        <Link href="/" className="btn-brand mt-4 inline-flex h-11 items-center px-6 text-sm">กลับหน้าแรก</Link>
      </div>
    );
  }

  return (
    <div>
      {/* ปกเต็มจอ + ปุ่มย้อนกลับลอยบนรูป (ตาม FoodU) */}
      <div className="relative -mx-4 -mt-4 h-56 w-[calc(100%+2rem)] overflow-hidden bg-neutral-200">
        {restaurant.cover_url ? (
          <img
            src={restaurant.cover_url}
            alt={`รูปร้าน ${restaurant.name}`}
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#FFC400] to-black text-5xl">
            <Soup className="h-10 w-10 text-neutral-300" aria-hidden />
          </span>
        )}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/40 to-transparent" aria-hidden />
        <div className="absolute inset-x-0 top-0 flex items-center justify-between p-4">
          <Link
            href="/"
            aria-label="ย้อนกลับหน้าแรก"
            className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full bg-white/95 shadow-md transition-transform active:scale-90"
          >
            <ChevronLeft className="h-5 w-5 text-black" aria-hidden />
          </Link>
          <div className="pointer-events-auto flex items-center gap-2">
            <button
              type="button"
              data-testid="favorite-toggle"
              aria-label={isFav ? `เอา ${restaurant.name} ออกจากร้านโปรด` : `เพิ่ม ${restaurant.name} ไปร้านโปรด`}
              aria-pressed={isFav}
              onClick={() => void toggleFav()}
              disabled={favBusy}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white/95 shadow-md transition-transform active:scale-90 disabled:opacity-60"
            >
              <Heart
                className={`h-5 w-5 ${isFav ? 'fill-black text-black' : 'text-black'}`}
                aria-hidden
              />
            </button>
            <span
              className={`rounded-full px-3 py-1.5 text-xs font-bold shadow-md ${
                restaurant.is_open ? 'bg-black text-[#FFC400]' : 'bg-white text-neutral-500'
              }`}
            >
              {restaurant.is_open ? 'เปิดอยู่' : 'ปิดแล้ว'}
            </span>
          </div>
        </div>
      </div>

      {/* แผ่นขาวลอยทับปก */}
      <div className="relative z-10 -mt-6 rounded-t-[2rem] bg-white pb-2 pt-5 shadow-[0_-8px_24px_rgba(0,0,0,0.06)]">
        <div className="mb-4 flex flex-col items-center gap-1 px-4 text-center">
          <h1 className="w-full truncate-1 text-xl font-bold text-black">{restaurant.name}</h1>
          <p className="truncate-2 w-full text-xs text-neutral-500">{restaurant.description ?? ''}</p>
          <div className="mt-1.5 flex flex-wrap items-center justify-center gap-2">
            <span className="flex items-center gap-1 rounded-full bg-black px-3 py-1 text-xs font-bold text-[#FFC400]">
              <Star className="h-3.5 w-3.5 fill-[#FFC400] stroke-[#FFC400]" aria-hidden />
              {(restaurant.rating ?? 0).toFixed(1)}
              <span className="font-normal text-white/70">({restaurant.total_reviews ?? 0})</span>
            </span>
            <span className="flex items-center gap-1 rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium text-neutral-600">
              <Clock className="h-3.5 w-3.5" aria-hidden />
              {restaurant.prep_time_avg_minutes ?? 20}-{(restaurant.prep_time_avg_minutes ?? 20) + 10} นาที
            </span>
            {(restaurant.cuisine_types ?? []).slice(0, 2).map((c) => (
              <span key={c} className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium text-neutral-600">
                {c}
              </span>
            ))}
          </div>
          {restaurant.address_line && (
            <p className="mt-1.5 flex max-w-full items-center gap-1 text-xs text-neutral-400">
              <MapPin className="h-3 w-3 shrink-0" aria-hidden />
              <span className="truncate-1">{restaurant.address_line}</span>
            </p>
          )}
        </div>

        {/* แท็บหมวดเมนู — ลอยใต้ header */}
        <div
          className="no-scrollbar sticky top-14 z-30 -mx-4 flex gap-2 overflow-x-auto border-b border-line bg-white/95 px-4 py-2.5 backdrop-blur"
          role="tablist"
          aria-label="หมวดเมนู"
        >
          {[{ id: 'all', name: 'ทั้งหมด' }, ...categories].map((c) => (
            <button
              key={c.id}
              role="tab"
              aria-selected={activeCat === c.id}
              onClick={() => setActiveCat(c.id)}
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                activeCat === c.id
                  ? 'bg-black text-[#FFC400]'
                  : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>

        {/* รายการเมนู */}
        <ul className="space-y-3 px-4 pt-3">
          {shown.length === 0 && (
            <p className="py-10 text-center text-sm text-neutral-400">ไม่มีเมนูในหมวดนี้</p>
          )}
          {shown.map((item) => (
            <li
              key={item.id}
              className="flex items-stretch gap-3 rounded-3xl border border-line bg-white p-3 shadow-sm"
            >
              <div className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-neutral-100">
                {item.image_url ? (
                  <img src={item.image_url} alt={`รูป ${item.name}`} className="h-full w-full object-cover" />
                ) : (
                  <span className="flex h-full w-full items-center justify-center text-neutral-300"><Utensils className="h-8 w-8" aria-hidden /></span>
                )}
              </div>
              <div className="flex min-w-0 flex-1 flex-col">
                <div className="flex items-center gap-2">
                  <h3 className="truncate-1 flex-1 text-sm font-bold text-black">{item.name}</h3>
                  {item.is_popular && (
                    <span className="shrink-0 rounded-full bg-[#FFC400] px-2 py-0.5 text-[10px] font-bold text-black">
                      ยอดนิยม
                    </span>
                  )}
                </div>
                <p className="truncate-2 text-xs leading-relaxed text-neutral-500">{item.description ?? ''}</p>
                <div className="mt-auto flex items-end justify-between pt-1">
                  <span className="text-base font-bold text-black">{baht(item.base_price)}</span>
                  <button
                    onClick={() => void addToCart(item.id)}
                    disabled={!item.is_available || adding === item.id}
                    aria-label={`เพิ่ม ${item.name} ลงตะกร้า`}
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-all active:scale-90 ${
                      added === item.id ? 'bg-black text-[#FFC400]' : 'btn-brand'
                    }`}
                  >
                    {added === item.id ? (
                      <Check className="h-4 w-4" aria-hidden />
                    ) : (
                      <Plus className="h-4 w-4" aria-hidden />
                    )}
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>

        {/* ============ คะแนนและรีวิว (จากลูกค้าที่สั่งซื้อจริง) ============ */}
        <section aria-label="คะแนนและรีวิว" className="mt-8 border-t border-line px-4 pb-6 pt-6">
          <div className="mb-4 flex items-center justify-between gap-2">
            <h2 className="text-lg font-bold text-black">คะแนนและรีวิว</h2>
            {!reviewsLoading && !reviewsError && reviewsData && reviewsData.count > 0 && (
              <span className="flex shrink-0 items-center gap-1 rounded-full bg-black px-3 py-1 text-xs font-bold text-[#FFC400]">
                <Star className="h-3.5 w-3.5 fill-[#FFC400] stroke-[#FFC400]" aria-hidden />
                {reviewsData.average.toFixed(1)}
                <span className="font-normal text-white/70">({reviewsData.count} รีวิว)</span>
              </span>
            )}
          </div>

          {reviewsLoading ? (
            <div className="space-y-3" aria-busy="true" aria-label="กำลังโหลดรีวิว">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-24 animate-pulse rounded-3xl bg-neutral-100" />
              ))}
            </div>
          ) : reviewsError ? (
            <div className="rounded-3xl border border-line bg-white p-6 text-center">
              <p className="text-sm text-red-500">{reviewsError}</p>
              <button
                onClick={loadReviews}
                className="mt-3 inline-flex h-11 items-center rounded-full border border-line px-6 text-sm font-semibold text-black transition-colors hover:bg-[#FFF4CC]"
              >
                ลองอีกครั้ง
              </button>
            </div>
          ) : !reviewsData || reviewsData.reviews.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-line bg-neutral-50 p-8 text-center">
              <span className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-[#FFF4CC]">
                <Star className="h-6 w-6 text-[#FFC400]" aria-hidden />
              </span>
              <p className="text-sm font-medium text-neutral-500">ยังไม่มีรีวิวสำหรับร้านนี้</p>
              <p className="mt-1 text-xs text-neutral-400">สั่งซื้อและเป็นคนแรกที่ให้คะแนนร้านนี้</p>
            </div>
          ) : (
            <ul className="space-y-3">
              {reviewsData.reviews.map((r) => (
                <li key={r.id} className="rounded-3xl border border-line bg-white p-4 shadow-sm">
                  <div className="flex items-center gap-3">
                    <span
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-black text-sm font-bold text-[#FFC400]"
                      aria-hidden
                    >
                      {(r.customerName || 'ล').trim().slice(0, 1)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate-1 text-sm font-bold text-black">{r.customerName}</p>
                      <p className="text-[11px] text-neutral-400">
                        {new Date(r.createdAt).toLocaleDateString('th-TH', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                          timeZone: 'Asia/Bangkok',
                        })}
                      </p>
                    </div>
                    <ReviewStars value={r.food_rating} />
                  </div>
                  {r.comment && (
                    <p className="mt-2 text-sm leading-relaxed text-neutral-600">{r.comment}</p>
                  )}
                  {r.reply && (
                    <div className="mt-3 rounded-2xl bg-[#FFF4CC] p-3">
                      <p className="flex items-center gap-1.5 text-xs font-bold text-black">
                        <MessageCircle className="h-3.5 w-3.5 shrink-0" aria-hidden />
                        ร้านตอบกลับ
                      </p>
                      <p className="mt-1 text-xs leading-relaxed text-neutral-600">{r.reply}</p>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
