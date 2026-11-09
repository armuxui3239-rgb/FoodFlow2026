'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import {
  ChevronLeft,
  CircleHelp,
  Heart,
  MapPin,
  Star,
  Utensils,
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { api } from '@/lib/client';

interface FavoriteItem {
  id: string;
  restaurant_id: string;
  restaurants: {
    id: string;
    name: string;
    logo_url: string | null;
    cover_url: string | null;
    rating: number | null;
    cuisine_types: string[] | null;
    is_open: boolean;
    address_line: string | null;
  } | null;
}

export default function FavoritesPage() {
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [removing, setRemoving] = useState<FavoriteItem | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    api<{ data: FavoriteItem[] }>('/api/favorites')
      .then((r) => setFavorites(r.data))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);
  useEffect(load, [load]);

  /** เอาร้านออกจากรายการโปรด (หลังยืนยันด้วย AlertDialog) */
  const removeFavorite = async () => {
    if (!removing) return;
    setBusy(true);
    try {
      await api(`/api/favorites?restaurantId=${encodeURIComponent(removing.restaurant_id)}`, {
        method: 'DELETE',
      });
      setFavorites((prev) => prev.filter((f) => f.id !== removing.id));
      setRemoving(null);
    } catch (e) {
      setError((e as Error).message);
      setRemoving(null);
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="กำลังโหลดรายการร้านโปรด">
        <div className="relative flex items-center justify-center py-1">
          <div className="h-10 w-10 animate-pulse rounded-full bg-neutral-100" />
        </div>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 rounded-3xl border border-line bg-white p-3">
            <div className="h-20 w-20 shrink-0 animate-pulse rounded-2xl bg-neutral-100" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-36 animate-pulse rounded bg-neutral-100" />
              <div className="h-3 w-24 animate-pulse rounded bg-neutral-100" />
              <div className="h-3 w-44 animate-pulse rounded bg-neutral-100" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-red-50">
          <CircleHelp className="h-8 w-8 text-red-400" aria-hidden />
        </span>
        <p className="text-sm text-red-500">{error}</p>
        <button onClick={load} className="btn-brand h-11 rounded-full px-6 text-sm">
          ลองอีกครั้ง
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* หัวเรื่อง — ย้อนกลับไปหน้าโปรไฟล์ */}
      <div className="relative flex items-center justify-center py-1">
        <Link
          href="/profile"
          aria-label="ย้อนกลับ"
          className="absolute left-0 flex h-10 w-10 items-center justify-center rounded-full border border-line bg-white hover:bg-neutral-50"
        >
          <ChevronLeft className="h-5 w-5" aria-hidden />
        </Link>
        <h1 className="text-lg font-bold text-black">ร้านโปรดของฉัน</h1>
      </div>

      {favorites.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <span className="flex h-24 w-24 items-center justify-center rounded-full bg-[#FFF4CC]">
            <Heart className="h-10 w-10 text-black" aria-hidden />
          </span>
          <h2 className="text-lg font-bold text-black">ยังไม่มีร้านโปรด</h2>
          <p className="max-w-64 text-sm text-neutral-400">
            กดหัวใจที่ร้านที่ชอบเพื่อบันทึกไว้ที่นี่
          </p>
          <Link href="/" className="btn-brand inline-flex h-12 items-center px-8 text-sm">
            เริ่มสำรวจร้านอาหาร
          </Link>
        </div>
      ) : (
        <ul className="space-y-3" aria-label="รายการร้านโปรด">
          {favorites.map((f) => {
            const r = f.restaurants;
            const href = `/restaurants/${r?.id ?? f.restaurant_id}`;
            return (
              <li
                key={f.id}
                className="flex items-center gap-3 rounded-3xl border border-line bg-white p-3 shadow-sm"
              >
                <Link
                  href={href}
                  className="flex min-w-0 flex-1 items-center gap-3"
                  aria-label={`ไปที่ร้าน ${r?.name ?? 'ร้านอาหาร'}`}
                >
                  <span className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-neutral-100">
                    {r?.logo_url || r?.cover_url ? (
                      <img
                        src={r!.logo_url ?? r!.cover_url ?? ''}
                        alt={`รูปร้าน ${r!.name}`}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center">
                        <Utensils className="h-7 w-7 text-neutral-300" aria-hidden />
                      </span>
                    )}
                  </span>
                  <span className="min-w-0 flex-1 space-y-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate-1 flex-1 text-sm font-bold text-black">
                        {r?.name ?? 'ร้านอาหาร'}
                      </span>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          r?.is_open ? 'bg-[#FFF4CC] text-black' : 'bg-neutral-100 text-neutral-400'
                        }`}
                      >
                        {r?.is_open ? 'เปิดอยู่' : 'ปิดอยู่'}
                      </span>
                    </span>
                    <span className="flex items-center gap-1 text-xs font-semibold text-black">
                      <Star className="h-3.5 w-3.5 fill-[#FFC400] text-black" aria-hidden />
                      {r?.rating != null ? r.rating.toFixed(1) : 'ยังไม่มีคะแนน'}
                    </span>
                    <span className="flex items-center gap-1 text-[11px] text-neutral-400">
                      <MapPin className="h-3 w-3 shrink-0" aria-hidden />
                      <span className="truncate-1">{r?.address_line ?? 'ไม่ระบุที่อยู่'}</span>
                    </span>
                  </span>
                </Link>
                <button
                  type="button"
                  onClick={() => setRemoving(f)}
                  disabled={busy}
                  aria-label={`เอาร้าน ${r?.name ?? 'ร้านอาหาร'} ออกจากรายการโปรด`}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-[#FFF4CC] active:scale-90"
                >
                  <Heart className="h-5 w-5 fill-black text-black" aria-hidden />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {/* ยืนยันก่อนเอาร้านออกจากรายการโปรด */}
      <AlertDialog open={removing !== null} onOpenChange={(open) => !open && setRemoving(null)}>
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle>เอาร้านนี้ออกจากรายการโปรด?</AlertDialogTitle>
            <AlertDialogDescription>
              คุณจะไม่ได้ติดตามร้าน {removing?.restaurants?.name ?? 'นี้'} อีกต่อไป
              สามารถกดหัวใจเพื่อเพิ่มกลับมาได้ในภายหลัง
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row gap-2">
            <AlertDialogCancel className="mt-0 flex-1 rounded-full border-line" disabled={busy}>
              ยกเลิก
            </AlertDialogCancel>
            <AlertDialogAction
              className="flex-1 rounded-full bg-black text-[#FFC400] hover:bg-black/90"
              disabled={busy}
              onClick={(e) => {
                e.preventDefault();
                void removeFavorite();
              }}
            >
              เอาออก
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
