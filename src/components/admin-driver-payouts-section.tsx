'use client';

import { useCallback, useEffect, useState } from 'react';
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

/** ส่วนบันทึกการจ่ายเงินให้ไรเดอร์ (D5) — บันทึกรายการโอน + ยืนยันเมื่อโอนจริง */
export function AdminDriverPayoutsSection({ driverId }: { driverId: string }) {
  const [rows, setRows] = useState<PayoutRow[] | null>(null);
  const [amountBaht, setAmountBaht] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api<{ data: PayoutRow[] }>(`/api/admin/drivers/${driverId}/payouts`)
      .then((r) => setRows(r.data ?? []))
      .catch((e: Error) => setError(e.message));
  }, [driverId]);

  useEffect(() => {
    void load();
  }, [load]);

  const create = async () => {
    const amount = Math.round(Number(amountBaht) * 100);
    if (!Number.isInteger(amount) || amount < 1000) {
      setError('ยอดจ่ายต้องเป็นจำนวนเต็มอย่างน้อย 10 บาท');
      return;
    }
    setBusy('new');
    setError('');
    try {
      await api(`/api/admin/drivers/${driverId}/payouts`, {
        method: 'POST',
        body: JSON.stringify({ amountSatang: amount }),
      });
      setAmountBaht('');
      load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy('');
    }
  };

  const settle = async (id: string) => {
    setBusy(id);
    setError('');
    try {
      await api(`/api/admin/payouts/${id}`, { method: 'PATCH', body: JSON.stringify({}) });
      load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy('');
    }
  };

  return (
    <section aria-label="การจ่ายเงินไรเดอร์" className="space-y-3 rounded-3xl border border-line bg-white p-4">
      <p className="text-sm font-bold text-black">การจ่ายเงินรายได้ (payout)</p>
      {error && (
        <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <input
          value={amountBaht}
          onChange={(e) => setAmountBaht(e.target.value.replace(/[^\d.]/g, ''))}
          inputMode="decimal"
          placeholder="ยอดโอน (บาท) เช่น 850"
          aria-label="ยอดโอนรายได้ (บาท)"
          className="min-w-0 flex-1 h-11 rounded-2xl border border-line bg-neutral-50 px-4 text-sm tabular-nums outline-none focus:border-[#FFC400]"
        />
        <button
          type="button"
          onClick={() => void create()}
          disabled={busy === 'new' || !amountBaht}
          className="btn-brand h-11 shrink-0 px-5 text-sm"
        >
          {busy === 'new' ? 'กำลังบันทึก…' : 'บันทึกการโอน'}
        </button>
      </div>

      {rows === null ? (
        <div className="h-24 animate-pulse rounded-3xl bg-neutral-100" />
      ) : rows.length === 0 ? (
        <p className="text-xs text-neutral-400">ยังไม่มีรายการจ่ายเงินสำหรับไรเดอร์คนนี้</p>
      ) : (
        <div className="overflow-hidden rounded-3xl border border-line">
          {rows.map((p) => (
            <div key={p.id} className="flex items-center gap-3 border-t border-line px-4 py-3 first:border-t-0">
              <div className="min-w-0 flex-1">
                <p className="truncate-1 text-sm font-bold text-black">{baht(p.amount)}</p>
                <p className="truncate-1 text-[11px] text-neutral-400">{th(p.created_at)}</p>
              </div>
              {p.status === 'pending' ? (
                <button
                  type="button"
                  onClick={() => void settle(p.id)}
                  disabled={busy === p.id}
                  className="shrink-0 rounded-full bg-black px-3 py-1.5 text-[11px] font-bold text-[#FFC400] disabled:opacity-50"
                >
                  ยืนยันโอนแล้ว
                </button>
              ) : (
                <span className="shrink-0 rounded-full bg-black px-2 py-0.5 text-[11px] font-bold text-[#FFC400]">
                  โอนแล้ว
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
