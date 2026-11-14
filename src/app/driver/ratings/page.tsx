'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, MessageSquareQuote, Star } from 'lucide-react';
import { api } from '@/lib/client';

interface RatingRow {
  id: string;
  orderCode: string;
  rating: number | null;
  comment: string | null;
  reply: string | null;
  createdAt: string;
}

/** หน้าประวัติคะแนนไรเดอร์ — รีวิวการจัดส่งจริงจากลูกค้า (reviews ที่ driver_id = ฉัน) */
export default function DriverRatingsPage() {
  const [rows, setRows] = useState<RatingRow[]>([]);
  const [average, setAverage] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api<{ average: number; total: number; data: RatingRow[] }>('/api/driver/ratings')
      .then((d) => {
        setRows(d.data);
        setAverage(d.average);
        setTotal(d.total);
        setError('');
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <header className="sticky top-0 z-40 border-b border-line bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-2 px-4">
          <Link
            href="/driver"
            aria-label="ย้อนกลับ"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-neutral-100 transition-transform active:scale-95"
          >
            <ArrowLeft className="h-5 w-5" aria-hidden />
          </Link>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#FFC400] text-black">
            <Star className="h-5 w-5" aria-hidden />
          </span>
          <h1 className="text-sm font-bold text-black">คะแนนการจัดส่ง</h1>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 space-y-4 px-4 py-5">
        {error && <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}

        {/* การ์ดคะแนนเฉลี่ย */}
        <section aria-label="คะแนนเฉลี่ย" className="rounded-3xl bg-black p-6">
          <p className="flex items-center gap-2 text-sm text-[#FFC400]">
            <Star className="h-5 w-5" aria-hidden /> คะแนนเฉลี่ยของคุณ
          </p>
          {loading ? (
            <div className="mt-2 h-10 w-24 animate-pulse rounded-2xl bg-neutral-800" />
          ) : (
            <p className="mt-1 text-5xl font-bold text-[#FFC400]">
              {average.toFixed(1)} <span className="text-lg text-neutral-400">/ 5.0</span>
            </p>
          )}
          <p className="mt-2 text-xs text-neutral-400">จากรีวิวการจัดส่ง {total} รายการ</p>
        </section>

        {/* รายการรีวิว */}
        <section aria-label="รายการรีวิว">
          <h2 className="mb-2 text-sm font-bold text-black">รีวิวจากลูกค้า</h2>
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-20 animate-pulse rounded-3xl bg-neutral-100" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <p className="rounded-3xl border border-dashed border-line px-4 py-10 text-center text-sm text-neutral-300">
              ยังไม่มีรีวิว — ส่งออเดอร์แรกแล้วลูกค้าจะให้คะแนนที่นี่
            </p>
          ) : (
            <ul className="space-y-3">
              {rows.map((r) => (
                <li key={r.id} className="rounded-3xl border border-line bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-bold text-black">#{r.orderCode}</span>
                    <span className="flex items-center gap-0.5" aria-label={`คะแนน ${r.rating ?? 'ยังไม่ให้คะแนน'} จาก 5`}>
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star
                          key={s}
                          className={`h-4 w-4 ${r.rating != null && s <= Number(r.rating) ? 'fill-[#FFC400] text-[#FFC400]' : 'text-neutral-200'}`}
                          aria-hidden
                        />
                      ))}
                    </span>
                  </div>
                  {r.comment && (
                    <p className="mt-2 flex items-start gap-2 text-sm text-neutral-700">
                      <MessageSquareQuote className="mt-0.5 h-4 w-4 shrink-0 text-neutral-300" aria-hidden />
                      {r.comment}
                    </p>
                  )}
                  {r.reply && (
                    <p className="mt-2 rounded-2xl bg-neutral-50 px-3 py-2 text-xs text-neutral-500">
                      ตอบกลับ: {r.reply}
                    </p>
                  )}
                  <p className="mt-2 text-[11px] text-neutral-400">
                    {new Date(r.createdAt).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>

      <footer className="mt-auto border-t border-line bg-white pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-4 text-center text-xs text-neutral-400">
        © {new Date().getFullYear()} ฟู๊ด ธันเดอร์ — พอร์ทัลไรเดอร์
      </footer>
    </div>
  );
}
