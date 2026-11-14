'use client';

import { useCallback, useEffect, useState } from 'react';
import { Bot, CircleAlert, RefreshCw, Zap } from 'lucide-react';
import { api } from '@/lib/client';
import { AdminFooter, AdminHeader } from '@/components/portal/admin-header';

interface ModelStat {
  model: string;
  provider: string;
  count: number;
  tokens: number;
  avgLatency: number;
}

interface AiMonitorData {
  totals: { events: number; success: number; error: number; tokensIn: number; tokensOut: number; avgLatency: number };
  byModel: ModelStat[];
  recentErrors: { id: string; model: string; error_code: string | null; created_at: string }[];
}

function num(n: number): string {
  return n.toLocaleString('th-TH');
}

/** หน้าติดตามระบบ AI — สถิติรวม + แยกตามโมเดล + ข้อผิดพลาดล่าสุด */
export default function AdminAiMonitorPage() {
  const [data, setData] = useState<AiMonitorData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tick, setTick] = useState(0);

  const load = useCallback(() => {
    setLoading(true);
    api<AiMonitorData>('/api/admin/ai-monitor')
      .then((r) => {
        setData(r);
        setError('');
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const t = setTimeout(load, 0); // หน่วงออกจาก effect body กัน cascading render
    return () => clearTimeout(t);
  }, [load, tick]);

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <AdminHeader />

      <main className="mx-auto w-full max-w-5xl flex-1 space-y-5 px-4 py-5">
        <div className="flex items-center justify-between gap-2">
          <h1 className="flex items-center gap-2 text-lg font-bold text-black">
            <Bot className="h-5 w-5" aria-hidden /> ติดตามระบบ AI
          </h1>
          <button
            onClick={() => setTick((x) => x + 1)}
            className="flex items-center gap-1.5 rounded-full border border-line px-3 py-2 text-xs font-semibold text-neutral-600 transition-colors hover:bg-neutral-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} aria-hidden /> รีเฟรช
          </button>
        </div>

        {error && (
          <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </p>
        )}

        {loading ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-24 animate-pulse rounded-3xl bg-neutral-100" />
              ))}
            </div>
            <div className="h-40 animate-pulse rounded-3xl bg-neutral-100" />
          </div>
        ) : !data ? (
          <div className="rounded-3xl border border-dashed border-line px-4 py-10 text-center">
            <Bot className="mx-auto h-8 w-8 text-neutral-300" aria-hidden />
            <p className="mt-2 text-sm text-neutral-400">ยังไม่มีข้อมูลการใช้งาน AI</p>
          </div>
        ) : (
          <>
            {/* การ์ดสถิติรวม */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-3xl border border-line bg-white p-4 shadow-sm">
                <p className="text-[11px] font-semibold text-neutral-400">เหตุการณ์ทั้งหมด</p>
                <p className="mt-1 text-xl font-bold text-black">{num(data.totals.events)}</p>
              </div>
              <div className="rounded-3xl border border-line bg-white p-4 shadow-sm">
                <p className="text-[11px] font-semibold text-neutral-400">สำเร็จ</p>
                <p className="mt-1 text-xl font-bold text-emerald-600">{num(data.totals.success)}</p>
              </div>
              <div className="rounded-3xl border border-line bg-white p-4 shadow-sm">
                <p className="text-[11px] font-semibold text-neutral-400">ผิดพลาด</p>
                <p className="mt-1 text-xl font-bold text-red-600">{num(data.totals.error)}</p>
              </div>
              <div className="rounded-3xl border border-line bg-white p-4 shadow-sm">
                <p className="flex items-center gap-1 text-[11px] font-semibold text-neutral-400">
                  <Zap className="h-3.5 w-3.5" aria-hidden /> ความหน่วงเฉลี่ย
                </p>
                <p className="mt-1 text-xl font-bold text-black">{num(data.totals.avgLatency)} มิลลิวินาที</p>
              </div>
            </div>

            <p className="text-xs text-neutral-500">
              โทเคนรับเข้า {num(data.totals.tokensIn)} · โทเคนส่งออก {num(data.totals.tokensOut)}
            </p>

            {/* ตารางแยกตามโมเดล */}
            <section aria-label="สถิติแยกตามโมเดล" className="overflow-hidden rounded-3xl border border-line bg-white shadow-sm">
              <h2 className="border-b border-line px-4 py-3 text-sm font-bold text-black">แยกตามโมเดล</h2>
              {data.byModel.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-neutral-400">ยังไม่มีการเรียกใช้โมเดล AI</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-neutral-50 text-left text-[11px] font-bold text-neutral-400">
                        <th scope="col" className="px-4 py-2">โมเดล</th>
                        <th scope="col" className="px-4 py-2">ผู้ให้บริการ</th>
                        <th scope="col" className="px-4 py-2 text-right">จำนวนครั้ง</th>
                        <th scope="col" className="px-4 py-2 text-right">โทเคนรวม</th>
                        <th scope="col" className="px-4 py-2 text-right">ความหน่วงเฉลี่ย</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.byModel.map((m) => (
                        <tr key={m.model} className="border-t border-line">
                          <td className="max-w-40 truncate-1 px-4 py-2.5 font-semibold text-black">{m.model}</td>
                          <td className="px-4 py-2.5 text-neutral-500">{m.provider}</td>
                          <td className="px-4 py-2.5 text-right text-black">{num(m.count)}</td>
                          <td className="px-4 py-2.5 text-right text-black">{num(m.tokens)}</td>
                          <td className="px-4 py-2.5 text-right text-neutral-500">{num(m.avgLatency)} มิลลิวินาที</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* ข้อผิดพลาดล่าสุด */}
            <section aria-label="ข้อผิดพลาดล่าสุด" className="overflow-hidden rounded-3xl border border-line bg-white shadow-sm">
              <h2 className="border-b border-line px-4 py-3 text-sm font-bold text-black">ข้อผิดพลาดล่าสุด</h2>
              {data.recentErrors.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-neutral-400">ไม่มีข้อผิดพลาด — ระบบทำงานปกติ</p>
              ) : (
                <ul>
                  {data.recentErrors.map((e, i) => (
                    <li key={e.id} className={`flex flex-wrap items-center gap-2 px-4 py-2.5 ${i > 0 ? 'border-t border-line' : ''}`}>
                      <CircleAlert className="h-4 w-4 shrink-0 text-red-500" aria-hidden />
                      <span className="truncate-1 text-xs font-semibold text-black">{e.error_code ?? 'ไม่ระบุรหัส'}</span>
                      <span className="truncate-1 text-[11px] text-neutral-400">{e.model}</span>
                      <span className="ml-auto shrink-0 text-[11px] text-neutral-400">
                        {new Date(e.created_at).toLocaleString('th-TH', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </main>

      <AdminFooter />
    </div>
  );
}
