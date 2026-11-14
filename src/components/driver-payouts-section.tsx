'use client';

import { useEffect, useState } from 'react';
import { api, baht } from '@/lib/client';

interface PayoutRow {
  id: string;
  amount: number;
  status: string;
  settlement_batch_id: string | null;
  created_at: string;
  settled_at: string | null;
}

function th(iso: string): string {
  return new Date(iso).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Bangkok' });
}

/** ส่วนแสดงประวัติการจ่ายเงินของไรเดอร์ (D5) — ศูนย์ควบคุมบันทึกการโอนรายได้ */
export function DriverPayoutsSection() {
  const [rows, setRows] = useState<PayoutRow[] | null>(null);

  useEffect(() => {
    api<{ data: PayoutRow[] }>('/api/driver/payouts')
      .then((r) => setRows(r.data ?? []))
      .catch(() => setRows([]));
  }, []);

  return (
    <section aria-label="การจ่ายเงินรายได้" className="space-y-2">
      <h2 className="text-sm font-bold text-black">การจ่ายเงินรายได้</h2>
      {rows === null ? (
        <div className="h-24 animate-pulse rounded-3xl bg-neutral-100" />
      ) : rows.length === 0 ? (
        <p className="rounded-3xl border border-dashed border-line px-4 py-6 text-center text-xs text-neutral-400">
          ยังไม่มีรายการโอนรายได้ — ศูนย์ควบคุมจะบันทึกการโอนไว้ที่นี่
        </p>
      ) : (
        <div className="overflow-hidden rounded-3xl border border-line bg-white">
          {rows.map((p) => (
            <div key={p.id} className="flex items-center gap-3 border-t border-line px-4 py-3 first:border-t-0">
              <div className="min-w-0 flex-1">
                <p className="truncate-1 text-sm font-bold text-black">{baht(p.amount)}</p>
                <p className="truncate-1 text-[11px] text-neutral-400">
                  {th(p.created_at)}{p.settled_at ? ` · โอนแล้ว ${th(p.settled_at)}` : ' · รอโอน'}
                </p>
              </div>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${
                  p.status === 'settled' ? 'bg-black text-[#FFC400]' : 'bg-[#FFF4CC] text-black'
                }`}
              >
                {p.status === 'settled' ? 'โอนแล้ว' : 'รอโอน'}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
