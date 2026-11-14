'use client';

import { useCallback, useEffect, useState } from 'react';
import { ClipboardList, Download, RefreshCw, Search } from 'lucide-react';
import { api } from '@/lib/client';
import { AdminFooter, AdminHeader } from '@/components/portal/admin-header';

interface LogRow {
  id: number;
  action: string;
  target_type: string | null;
  target_id: string | null;
  old_value: unknown;
  new_value: unknown;
  ip_address: string | null;
  created_at: string;
  severity: string | null;
  adminName: string;
}

function SeverityBadge({ severity }: { severity: string | null }) {
  const s = severity ?? 'info';
  const cls =
    s === 'error'
      ? 'bg-red-50 text-red-600'
      : s === 'warn'
        ? 'bg-[#FFF4CC] text-black'
        : 'bg-neutral-100 text-neutral-500';
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${cls}`}>{s}</span>;
}

function pretty(v: unknown): string {
  if (v == null) return '-';
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}

/** หน้าบันทึกกิจกรรมผู้ดูแล — ค้นหา action + กรองช่วงวันที่ + แบ่งหน้า 20 รายการ + ส่งออก CSV */
export default function AdminLogsPage() {
  const [action, setAction] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [curPage, setCurPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const query = useCallback(() => {
    const qs = new URLSearchParams();
    if (action.trim()) qs.set('action', action.trim());
    if (from) qs.set('from', from);
    if (to) qs.set('to', to);
    qs.set('page', String(page));
    return qs;
  }, [action, from, to, page]);

  const load = useCallback(() => {
    setLoading(true);
    api<{ data: LogRow[]; page: number }>(`/api/admin/audit-logs?${query()}`)
      .then((r) => {
        setLogs(r.data);
        setCurPage(r.page ?? page);
        setError('');
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [query, page]);

  useEffect(() => {
    const t = setTimeout(load, action ? 300 : 0); // พิมพ์ค้นหาแบบหน่วงเวลา
    return () => clearTimeout(t);
  }, [load, action]);

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <AdminHeader />

      <main className="mx-auto w-full max-w-5xl flex-1 space-y-4 px-4 py-5">
        <div className="flex items-center justify-between gap-2">
          <h1 className="flex items-center gap-2 text-lg font-bold text-black">
            <ClipboardList className="h-5 w-5" aria-hidden /> บันทึกกิจกรรมผู้ดูแล
          </h1>
          <div className="flex gap-1.5">
            <button
              onClick={() => load()}
              className="flex items-center gap-1.5 rounded-full border border-line px-3 py-2 text-xs font-semibold text-neutral-600 transition-colors hover:bg-neutral-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} aria-hidden /> รีเฟรช
            </button>
            <a
              href={`/api/admin/audit-logs?${query()}&format=csv`}
              className="flex items-center gap-1.5 rounded-full bg-black px-3 py-2 text-xs font-bold text-[#FFC400] transition-transform active:scale-95"
            >
              <Download className="h-3.5 w-3.5" aria-hidden /> CSV
            </a>
          </div>
        </div>

        {/* ค้นหาการกระทำ + ช่วงวันที่ */}
        <div className="flex flex-col gap-2 sm:flex-row">
          <label className="flex h-11 flex-1 items-center gap-2 rounded-full border border-line bg-neutral-50 px-4">
            <Search className="h-4 w-4 shrink-0 text-neutral-400" aria-hidden />
            <input
              value={action}
              onChange={(e) => {
                setPage(1);
                setAction(e.target.value);
              }}
              placeholder="ค้นหาการกระทำ เช่น approve"
              aria-label="ค้นหาการกระทำ"
              className="w-full bg-transparent text-sm text-black outline-none placeholder:text-neutral-400"
            />
          </label>
          <label className="flex h-11 items-center gap-2 rounded-full border border-line bg-neutral-50 px-4">
            <span className="text-xs font-semibold text-neutral-500">จาก</span>
            <input
              type="date"
              value={from}
              onChange={(e) => {
                setPage(1);
                setFrom(e.target.value);
              }}
              aria-label="วันที่เริ่มต้น"
              className="bg-transparent text-sm text-black outline-none"
            />
          </label>
          <label className="flex h-11 items-center gap-2 rounded-full border border-line bg-neutral-50 px-4">
            <span className="text-xs font-semibold text-neutral-500">ถึง</span>
            <input
              type="date"
              value={to}
              onChange={(e) => {
                setPage(1);
                setTo(e.target.value);
              }}
              aria-label="วันที่สิ้นสุด"
              className="bg-transparent text-sm text-black outline-none"
            />
          </label>
        </div>

        {error && (
          <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </p>
        )}

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-3xl bg-neutral-100" />
            ))}
          </div>
        ) : logs.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-line px-4 py-10 text-center">
            <ClipboardList className="mx-auto h-8 w-8 text-neutral-300" aria-hidden />
            <p className="mt-2 text-sm text-neutral-400">ไม่พบบันทึกในเงื่อนไขนี้</p>
          </div>
        ) : (
          <>
            <ul className="overflow-hidden rounded-3xl border border-line bg-white">
              {logs.map((l, i) => (
                <li key={l.id} className={`px-4 py-3 ${i > 0 ? 'border-t border-line' : ''}`}>
                  <details>
                    <summary className="flex cursor-pointer flex-wrap items-center gap-2 [&::-webkit-details-marker]:hidden">
                      <span className="text-sm font-bold text-black">{l.action}</span>
                      {l.target_type && <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-semibold text-neutral-500">{l.target_type}</span>}
                      <SeverityBadge severity={l.severity} />
                      <span className="ml-auto text-[11px] text-neutral-400">
                        {l.adminName} ·{' '}
                        {new Date(l.created_at).toLocaleString('th-TH', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </summary>
                    <div className="mt-2 space-y-1.5 text-[11px] text-neutral-500">
                      <p>เป้าหมาย: {l.target_type ?? '-'}{l.target_id ? ` (${l.target_id})` : ''}{l.ip_address ? ` · IP ${l.ip_address}` : ''}</p>
                      <div className="grid gap-1.5 sm:grid-cols-2">
                        <div>
                          <p className="mb-0.5 font-semibold text-neutral-400">ค่าเดิม</p>
                          <pre className="max-h-40 overflow-y-auto rounded-2xl bg-neutral-50 p-3 text-[11px] text-neutral-600">{pretty(l.old_value)}</pre>
                        </div>
                        <div>
                          <p className="mb-0.5 font-semibold text-neutral-400">ค่าใหม่</p>
                          <pre className="max-h-40 overflow-y-auto rounded-2xl bg-neutral-50 p-3 text-[11px] text-neutral-600">{pretty(l.new_value)}</pre>
                        </div>
                      </div>
                    </div>
                  </details>
                </li>
              ))}
            </ul>

            {/* แบ่งหน้า — 20 รายการต่อหน้า */}
            <div className="flex items-center justify-between gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={curPage <= 1}
                className="flex h-10 items-center rounded-full border border-line px-4 text-xs font-bold text-neutral-600 transition-colors hover:bg-neutral-50 disabled:opacity-40"
              >
                หน้าก่อน
              </button>
              <span className="text-xs font-semibold text-neutral-500">หน้า {curPage}</span>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={logs.length < 20}
                className="flex h-10 items-center rounded-full border border-line px-4 text-xs font-bold text-neutral-600 transition-colors hover:bg-neutral-50 disabled:opacity-40"
              >
                หน้าถัดไป
              </button>
            </div>
          </>
        )}
      </main>

      <AdminFooter />
    </div>
  );
}
