'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Gift, Target } from 'lucide-react';
import { api, baht } from '@/lib/client';

interface CampaignRow {
  id: string;
  title: string;
  rewardSatang: number;
  targetOrders: number;
  startsAt: string;
  endsAt: string;
  progress: number;
}

/** หน้าโบนัสไรเดอร์ — แคมเปญจริงจาก driver_incentive_campaigns + ความคืบหน้าจากงานที่ส่งสำเร็จ */
export default function DriverIncentivesPage() {
  const [rows, setRows] = useState<CampaignRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api<{ data: CampaignRow[] }>('/api/driver/incentives')
      .then((d) => {
        setRows(d.data);
        setError('');
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });

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
            <Gift className="h-5 w-5" aria-hidden />
          </span>
          <h1 className="text-sm font-bold text-black">โบนัสรับงาน</h1>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 space-y-4 px-4 py-5">
        {error && <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-28 animate-pulse rounded-3xl bg-neutral-100" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-line px-4 py-12 text-center">
            <Target className="h-10 w-10 text-neutral-300" aria-hidden />
            <p className="text-sm text-neutral-400">ยังไม่มีแคมเปญโบนัสที่เปิดอยู่ — รับข่าวสารผ่านหน้าแจ้งเตือน</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {rows.map((c) => {
              const pct = c.targetOrders > 0 ? Math.min(100, Math.round((c.progress / c.targetOrders) * 100)) : 0;
              return (
                <li key={c.id} className="rounded-3xl border border-line bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-black">{c.title}</p>
                      <p className="text-[11px] text-neutral-400">
                        {fmtDate(c.startsAt)} – {fmtDate(c.endsAt)}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full bg-black px-3 py-1 text-xs font-bold text-[#FFC400]">
                      รับ {baht(c.rewardSatang)}
                    </span>
                  </div>
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-[11px] text-neutral-500">
                      <span>
                        ส่งสำเร็จ {c.progress}/{c.targetOrders} งาน
                      </span>
                      <span>{pct}%</span>
                    </div>
                    <div
                      className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-neutral-100"
                      role="progressbar"
                      aria-valuenow={c.progress}
                      aria-valuemin={0}
                      aria-valuemax={c.targetOrders}
                      aria-label={`ความคืบหน้าโบนัส ${c.title}`}
                    >
                      <div className="h-full rounded-full bg-[#FFC400] transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </main>

      <footer className="mt-auto border-t border-line bg-white pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-4 text-center text-xs text-neutral-400">
        © {new Date().getFullYear()} ฟู๊ด ธันเดอร์ — พอร์ทัลไรเดอร์
      </footer>
    </div>
  );
}
