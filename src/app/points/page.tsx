'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowLeft, Coins, Sparkles } from 'lucide-react';
import { api } from '@/lib/client';

interface PointRow {
  id: string;
  points: number;
  type: string;
  description: string | null;
  order_id: string | null;
  created_at: string;
}

/** หน้าแต้มสะสม — ข้อมูลจริงจาก loyalty_transactions */
export default function PointsPage() {
  const [total, setTotal] = useState<number | null>(null);
  const [rows, setRows] = useState<PointRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api<{ total: number; data: PointRow[] }>('/api/points')
      .then((d) => {
        setTotal(d.total);
        setRows(d.data);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <header className="sticky top-0 z-40 border-b border-line bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-2 px-4">
          <Link
            href="/profile"
            aria-label="ย้อนกลับ"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-neutral-100 transition-transform active:scale-95"
          >
            <ArrowLeft className="h-5 w-5" aria-hidden />
          </Link>
          <h1 className="text-lg font-bold text-black">แต้มสะสม</h1>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 space-y-5 px-4 py-5">
        {error && (
          <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </p>
        )}

        {/* การ์ดแต้มรวม */}
        <section aria-label="แต้มรวม" className="rounded-3xl bg-black p-6 text-white">
          <p className="flex items-center gap-2 text-sm text-[#FFC400]">
            <Coins className="h-5 w-5" aria-hidden /> แต้มของคุณ
          </p>
          {total === null ? (
            <div className="mt-2 h-10 w-32 animate-pulse rounded-2xl bg-neutral-800" />
          ) : (
            <p className="mt-1 text-5xl font-bold text-[#FFC400]">
              {total.toLocaleString('th-TH')} <span className="text-lg text-white/70">แต้ม</span>
            </p>
          )}
          <p className="mt-2 text-xs text-white/60">สะสมแต้มจากทุกคำสั่งซื้อที่สำเร็จ — ใช้แลกส่วนลดในออเดอร์ถัดไป</p>
        </section>

        {/* ประวัติ */}
        <section aria-label="ประวัติแต้ม">
          <h2 className="mb-2 flex items-center gap-2 text-sm font-bold text-black">
            ประวัติการสะสม <Sparkles className="h-4 w-4 text-[#FFC400]" aria-hidden />
          </h2>
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-14 animate-pulse rounded-2xl bg-neutral-100" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <p className="rounded-3xl border border-dashed border-line px-4 py-8 text-center text-sm text-neutral-300">
              ยังไม่มีรายการสะสม — สั่งอาหารครบวงจรแล้วจะได้รับแต้มทันที
            </p>
          ) : (
            <ul className="overflow-hidden rounded-3xl border border-line bg-white">
              {rows.map((r, i) => (
                <li key={r.id} className={`flex items-center gap-3 px-4 py-3 ${i > 0 ? 'border-t border-line' : ''}`}>
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${Number(r.points) >= 0 ? 'bg-[#FFF4CC]' : 'bg-neutral-100'}`}>
                    <Coins className="h-4 w-4 text-black" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate-1 text-sm font-semibold text-black">{r.description ?? 'สะสมแต้ม'}</p>
                    <p className="text-[11px] text-neutral-400">
                      {new Date(r.created_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                  <span className={`shrink-0 text-sm font-bold ${Number(r.points) >= 0 ? 'text-black' : 'text-red-600'}`}>
                    {Number(r.points) >= 0 ? '+' : ''}
                    {r.points}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>

      <footer className="mt-auto border-t border-line bg-white pb-[calc(env(safe-area-inset-bottom)+5.5rem)] pt-4 text-center text-xs text-neutral-400">
        © {new Date().getFullYear()} ฟู๊ด ธันเดอร์ — สั่งอาหาร ส่งไว ถึงบ้าน
      </footer>
    </div>
  );
}
