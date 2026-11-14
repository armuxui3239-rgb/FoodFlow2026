'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, CircleAlert, RefreshCw } from 'lucide-react';
import { api, baht } from '@/lib/client';

interface RefundRow {
  id: string;
  order_id: string;
  amount: number;
  kind: string;
  reason: string;
  method: string;
  status: string;
  created_at: string;
  review_note: string | null;
  users: { full_name: string | null; email: string | null } | null;
  orders: { order_code: string; status: string } | null;
}

const STATUS_TH: Record<string, string> = {
  manual_review: 'รอตรวจสอบ',
  completed: 'อนุมัติ-คืนแล้ว',
  failed: 'ปฏิเสธแล้ว',
};

function statusClass(status: string): string {
  if (status === 'manual_review') return 'bg-[#FFC400] text-black';
  if (status === 'completed') return 'bg-black text-[#FFC400]';
  return 'border border-red-200 bg-white text-red-600';
}

function thaiDateTime(iso: string): string {
  return new Date(iso).toLocaleString('th-TH', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'Asia/Bangkok',
  });
}

/** หน้าตรวจคำขอคืนเงิน (แอดมิน) — อนุมัติ = เงินคืนเข้ากระเป๋าลูกค้าอัตโนมัติ + audit (D1) */
export default function AdminRefundsPage() {
  const [rows, setRows] = useState<RefundRow[] | null>(null);
  const [busyId, setBusyId] = useState('');
  const [noteFor, setNoteFor] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const r = await api<{ data: RefundRow[] }>('/api/admin/refunds');
      setRows(r.data ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'โหลดข้อมูลไม่สำเร็จ');
      setRows([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const act = async (id: string, action: 'approve' | 'reject') => {
    setBusyId(id);
    setError('');
    try {
      await api(`/api/admin/refunds/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ action, note: noteFor === id ? note : undefined }),
      });
      setNote('');
      setNoteFor('');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ดำเนินการไม่สำเร็จ');
    } finally {
      setBusyId('');
    }
  };

  const pending = (rows ?? []).filter((r) => r.status === 'manual_review');
  const history = (rows ?? []).filter((r) => r.status !== 'pending');

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <header className="sticky top-0 z-40 border-b border-line bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-2 px-4">
          <div className="flex min-w-0 items-center gap-2">
            <Link
              href="/admin"
              aria-label="ย้อนกลับ"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-neutral-100 transition-transform active:scale-95"
            >
              <ArrowLeft className="h-5 w-5" aria-hidden />
            </Link>
            <div className="min-w-0">
              <p className="truncate-1 text-sm font-bold text-black">ตรวจคำขอคืนเงิน</p>
              <p className="truncate-1 text-[11px] text-neutral-400">
                อนุมัติ = เงินคืนเข้ากระเป๋าลูกค้าทันที + แจ้งเตือน + audit
              </p>
            </div>
          </div>
          <button
            onClick={() => void load()}
            aria-label="รีเฟรช"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full hover:bg-neutral-100"
          >
            <RefreshCw className="h-5 w-5 text-neutral-500" aria-hidden />
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 space-y-6 px-4 py-5">
        {error && (
          <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </p>
        )}

        {rows === null ? (
          <div className="h-56 animate-pulse rounded-3xl bg-neutral-100" />
        ) : pending.length === 0 ? (
          <div className="flex flex-col items-center gap-4 rounded-3xl border border-dashed border-line py-16 text-center">
            <p className="text-lg font-bold text-black">ไม่มีคำขอคืนเงินรอตรวจสอบ</p>
            <p className="text-sm text-neutral-400">คำขอใหม่จะปรากฏที่นี่เมื่อลูกค้าส่งคำขอ</p>
          </div>
        ) : (
          <section aria-label="รอตรวจสอบ" className="space-y-4">
            <h2 className="text-sm font-bold text-black">รอตรวจสอบ ({pending.length})</h2>
            {pending.map((r) => (
              <article key={r.id} className="space-y-3 rounded-3xl border border-line bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate-1 text-sm font-bold text-black">
                      {r.users?.full_name ?? 'ไม่ทราบชื่อ'} · #{r.orders?.order_code ?? '-'}
                    </p>
                    <p className="truncate-1 text-[11px] text-neutral-400">
                      {thaiDateTime(r.created_at)} · ชำระผ่าน {r.method}
                    </p>
                  </div>
                  <p className="shrink-0 text-lg font-bold tabular-nums text-black">{baht(r.amount)}</p>
                </div>
                <p className="rounded-2xl bg-neutral-50 px-4 py-3 text-xs leading-relaxed text-neutral-600">
                  เหตุผล: {r.reason}
                </p>

                {noteFor === r.id ? (
                  <input
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="หมายเหตุ (ถ้ามี เช่น เหตุผลการปฏิเสธ)"
                    className="h-11 w-full rounded-2xl border border-line bg-neutral-50 px-4 text-sm outline-none focus:border-[#FFC400]"
                  />
                ) : null}

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => void act(r.id, 'approve')}
                    disabled={busyId === r.id}
                    className="btn-brand h-11 flex-1 text-sm"
                  >
                    {busyId === r.id ? 'กำลังดำเนินการ…' : `อนุมัติคืนเงิน ${baht(r.amount)} เข้ากระเป๋า`}
                  </button>
                  {noteFor === r.id ? (
                    <button
                      type="button"
                      onClick={() => void act(r.id, 'reject')}
                      disabled={busyId === r.id}
                      className="h-11 flex-1 rounded-full border border-red-200 bg-white text-sm font-bold text-red-600 hover:bg-red-50 disabled:opacity-50"
                    >
                      ยืนยันปฏิเสธ
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => { setNoteFor(r.id); setNote(''); }}
                      disabled={busyId === r.id}
                      className="h-11 flex-1 rounded-full border border-red-200 bg-white text-sm font-bold text-red-600 hover:bg-red-50 disabled:opacity-50"
                    >
                      ปฏิเสธ
                    </button>
                  )}
                </div>
              </article>
            ))}
          </section>
        )}

        {rows !== null && history.length > 0 && (
          <section aria-label="ประวัติคำขอคืนเงิน" className="space-y-2">
            <h2 className="text-sm font-bold text-black">ประวัติล่าสุด</h2>
            <div className="overflow-hidden rounded-3xl border border-line bg-white">
              {history.map((r) => (
                <div key={r.id} className="flex items-center gap-3 border-t border-line px-4 py-3 first:border-t-0">
                  <div className="min-w-0 flex-1">
                    <p className="truncate-1 text-sm font-bold text-black">
                      #{r.orders?.order_code ?? '-'} · {r.users?.full_name ?? 'ไม่ทราบชื่อ'}
                    </p>
                    <p className="truncate-1 text-[11px] text-neutral-400">
                      {thaiDateTime(r.created_at)}
                      {r.review_note ? ` · หมายเหตุ: ${r.review_note}` : ''}
                    </p>
                  </div>
                  <p className="shrink-0 text-sm font-bold tabular-nums text-black">{baht(r.amount)}</p>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${statusClass(r.status)}`}>
                    {STATUS_TH[r.status] ?? r.status}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        <p className="text-xs leading-relaxed text-neutral-400">
          การอนุมัติจะเพิ่มเงินเข้ากระเป๋าลูกค้าทันที (บันทึก wallet_transactions) ออเดอร์เปลี่ยนสถานะเป็น refunded
          และแจ้งเตือนลูกค้าในแอป — ทุกคำขอบันทึกใน audit log
        </p>
      </main>
    </div>
  );
}
