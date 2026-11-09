'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import {
  Clock,
  History,
  MapPin,
  Search,
  SearchX,
  Soup,
  Star,
  Trash2,
  TriangleAlert,
  Utensils,
  X,
} from 'lucide-react';
import { api } from '@/lib/client';

interface Restaurant {
  id: string;
  name: string;
  cover_url: string | null;
  address_line: string | null;
  cuisine_types: string[] | null;
  rating: number | null;
  is_open: boolean;
  prep_time_avg_minutes: number | null;
}

const RECENT_KEY = 'ft_recent_searches';
const MAX_RECENT = 8;

/** คำค้นยอดนิยมแนะนำ — ไอคอนจากไฟล์ SVG (lucide-react) ห้ามใช้อีโมจิ */
const SUGGESTIONS = ['ก๋วยเตี๋ยว', 'ข้าวผัด', 'ไก่ทอด', 'ส้มตำ', 'พิซซ่า', 'ชานมไข่มุก'];

/* ---------- คลัง "ค้นหาล่าสุด": localStorage + useSyncExternalStore ---------- */

let recentCache: string[] | null = null;
const recentListeners = new Set<() => void>();

function readRecentFromStorage(): string[] {
  try {
    const raw = window.localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((t): t is string => typeof t === 'string' && t.trim() !== '').slice(0, MAX_RECENT);
  } catch {
    return [];
  }
}

function getRecentSnapshot(): string[] {
  if (recentCache === null) recentCache = readRecentFromStorage();
  return recentCache;
}

/** SSR/hydration — ฝั่งเซิร์ฟเวอร์ไม่มี localStorage จึงเริ่มจากลิสต์ว่าง */
function getRecentServerSnapshot(): string[] {
  return [];
}

function subscribeRecent(listener: () => void): () => void {
  recentListeners.add(listener);
  return () => {
    recentListeners.delete(listener);
  };
}

function writeRecent(next: string[]): void {
  recentCache = next.slice(0, MAX_RECENT);
  try {
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(recentCache));
  } catch {
    /* พื้นที่เก็บข้อมูลใช้ไม่ได้ — ยังแสดงผลหน้าจอได้ตามปกติ */
  }
  recentListeners.forEach((l) => l());
}

export default function SearchPage() {
  const recent = useSyncExternalStore(subscribeRecent, getRecentSnapshot, getRecentServerSnapshot);
  const [term, setTerm] = useState('');
  const [submitted, setSubmitted] = useState('');
  const [results, setResults] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const seqRef = useRef(0);

  const remember = useCallback((word: string) => {
    writeRecent([word, ...getRecentSnapshot().filter((t) => t !== word)]);
  }, []);

  const removeRecent = useCallback((word: string) => {
    writeRecent(getRecentSnapshot().filter((t) => t !== word));
  }, []);

  const clearRecent = useCallback(() => writeRecent([]), []);

  // ค้นหาทันทีแบบ debounce 300ms
  useEffect(() => {
    const timer = setTimeout(() => {
      const word = term.trim();
      setSubmitted(word);
      if (!word) {
        setResults([]);
        setError('');
        setLoading(false);
        return;
      }
      const seq = ++seqRef.current;
      setLoading(true);
      setError('');
      api<{ data: Restaurant[] }>(`/api/restaurants?q=${encodeURIComponent(word)}`)
        .then((r) => {
          if (seqRef.current !== seq) return;
          setResults(r.data);
          remember(word);
        })
        .catch((e: Error) => {
          if (seqRef.current !== seq) return;
          setError(e.message);
          setResults([]);
        })
        .finally(() => {
          if (seqRef.current === seq) setLoading(false);
        });
    }, 300);
    return () => clearTimeout(timer);
  }, [term, remember]);

  const retry = useCallback(() => {
    if (!submitted) return;
    setTerm(submitted);
    const seq = ++seqRef.current;
    setLoading(true);
    setError('');
    api<{ data: Restaurant[] }>(`/api/restaurants?q=${encodeURIComponent(submitted)}`)
      .then((r) => {
        if (seqRef.current !== seq) return;
        setResults(r.data);
      })
      .catch((e: Error) => {
        if (seqRef.current !== seq) return;
        setError(e.message);
      })
      .finally(() => {
        if (seqRef.current === seq) setLoading(false);
      });
  }, [submitted]);

  const searching = submitted !== '';

  return (
    <div className="space-y-5">
      <h1 className="sr-only">ค้นหาร้านและเมนูอาหาร</h1>

      {/* ช่องค้นหา — autofocus ค้นทันทีแบบ debounce 300ms */}
      <search className="flex items-center gap-3 pt-1">
        <div className="flex h-12 flex-1 items-center gap-2 rounded-full bg-neutral-100 px-4">
          <Search className="h-5 w-5 shrink-0 text-neutral-400" aria-hidden />
          <input
            autoFocus
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="ค้นหาร้านหรือเมนูอาหาร"
            aria-label="ค้นหาร้านหรือเมนูอาหาร"
            className="h-full w-full bg-transparent text-sm outline-none placeholder:text-neutral-400"
          />
          {term !== '' && (
            <button
              type="button"
              onClick={() => setTerm('')}
              aria-label="ล้างช่องค้นหา"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-neutral-400 transition-colors hover:text-black"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          )}
        </div>
      </search>

      {/* โหมดไม่ได้พิมพ์ค้นหา: ค้นหาล่าสุด + คำแนะนำ */}
      {!searching && (
        <>
          {recent.length > 0 && (
            <section aria-label="ค้นหาล่าสุด">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="flex items-center gap-1.5 text-base font-bold text-black">
                  <History className="h-4.5 w-4.5 text-black" aria-hidden />
                  ค้นหาล่าสุด
                </h2>
                <button
                  type="button"
                  onClick={clearRecent}
                  className="flex h-11 items-center gap-1.5 rounded-full px-3 text-xs font-semibold text-neutral-400 transition-colors hover:text-black"
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                  ลบทั้งหมด
                </button>
              </div>
              <ul className="overflow-hidden rounded-3xl border border-line bg-white">
                {recent.map((t, i) => (
                  <li key={t} className={`flex items-center ${i > 0 ? 'border-t border-line' : ''}`}>
                    <button
                      type="button"
                      onClick={() => setTerm(t)}
                      className="flex h-11 min-w-0 flex-1 items-center gap-2.5 px-4 text-sm text-neutral-700 transition-colors hover:bg-[#FFF4CC]/60"
                    >
                      <History className="h-4 w-4 shrink-0 text-neutral-400" aria-hidden />
                      <span className="truncate-1">{t}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => removeRecent(t)}
                      aria-label={`ลบคำค้นหา ${t}`}
                      className="flex h-11 w-11 shrink-0 items-center justify-center text-neutral-300 transition-colors hover:text-black"
                    >
                      <X className="h-4 w-4" aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section aria-label="คำค้นหาแนะนำ">
            <h2 className="mb-3 text-base font-bold text-black">ค้นหาอะไรดี ?</h2>
            {recent.length === 0 && (
              <p className="mb-3 text-sm text-neutral-400">พิมพ์ชื่อร้านหรือเมนู หรือเลือกจากคำแนะนำด้านล่าง</p>
            )}
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setTerm(s)}
                  className="flex h-11 items-center gap-1.5 rounded-full border border-line bg-white px-4 text-sm font-medium text-neutral-700 transition-colors hover:bg-[#FFF4CC]"
                >
                  <Soup className="h-4 w-4 shrink-0 text-[#FFC400]" aria-hidden />
                  {s}
                </button>
              ))}
            </div>
          </section>
        </>
      )}

      {/* โหมดค้นหา: loading / error / ไม่พบ / ผลลัพธ์ */}
      {searching && (
        <section aria-label="ผลการค้นหา" aria-busy={loading}>
          <p className="mb-3 text-sm text-neutral-500">
            ผลการค้นหา <span className="font-bold text-black">&ldquo;{submitted}&rdquo;</span>
          </p>

          {loading ? (
            <ul className="grid gap-4 sm:grid-cols-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <li key={i} className="h-56 animate-pulse rounded-3xl bg-neutral-100" />
              ))}
            </ul>
          ) : error !== '' ? (
            <div className="flex flex-col items-center gap-4 py-16 text-center">
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-red-50">
                <TriangleAlert className="h-8 w-8 text-red-400" aria-hidden />
              </span>
              <p className="text-sm text-red-500">{error}</p>
              <button type="button" onClick={retry} className="btn-brand inline-flex h-11 items-center px-8 text-sm">
                ลองอีกครั้ง
              </button>
            </div>
          ) : results.length === 0 ? (
            /* ตามต้นแบบ Search: SearchX ในวงกลม + ข้อความ + ปุ่มดูร้านทั้งหมด */
            <div className="flex flex-col items-center gap-4 py-16 text-center">
              <span className="flex h-20 w-20 items-center justify-center rounded-full bg-[#FFF4CC]">
                <SearchX className="h-9 w-9 text-black" aria-hidden />
              </span>
              <h2 className="text-lg font-bold text-black">ไม่พบสิ่งที่ค้นหา</h2>
              <p className="text-sm text-neutral-400">ลองคำอื่น หรือดูร้านทั้งหมด</p>
              <Link href="/" className="btn-brand inline-flex h-11 items-center px-8 text-sm">
                ดูร้านทั้งหมด
              </Link>
            </div>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2">
              {results.map((r) => (
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
      )}
    </div>
  );
}
