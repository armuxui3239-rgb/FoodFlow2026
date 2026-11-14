'use client';

import { useCallback, useEffect, useState } from 'react';
import { Download, FileDown, RefreshCw } from 'lucide-react';
import { api } from '@/lib/client';
import { AdminFooter, AdminHeader } from '@/components/portal/admin-header';

interface JobRow {
  id: string;
  resource: string;
  format: string;
  status: string;
  progress: number;
  file_url: string | null;
  error_message: string | null;
  expires_at: string | null;
  created_at: string;
  requestedByName: string;
}

const RESOURCE_TH: Record<string, string> = {
  orders: 'ออเดอร์',
  users: 'ผู้ใช้',
  restaurants: 'ร้านค้า',
  reviews: 'รีวิว',
};

const STATUS_TH: Record<string, string> = {
  queued: 'รอดำเนินการ',
  running: 'กำลังประมวลผล',
  completed: 'เสร็จสิ้น',
  failed: 'ล้มเลิก',
  cancelled: 'ยกเลิก',
};

function statusCls(status: string): string {
  if (status === 'completed') return 'bg-black text-[#FFC400]';
  if (status === 'failed') return 'bg-red-50 text-red-600';
  if (status === 'running') return 'bg-[#FFC400] text-black';
  return 'bg-neutral-100 text-neutral-500';
}

/** หน้างานส่งออกข้อมูล — สร้างไฟล์ CSV ทันที (synchronous) + ดาวน์โหลดผ่าน /api/admin/exports/[id] */
export default function AdminExportJobsPage() {
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [resource, setResource] = useState('orders');
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tick, setTick] = useState(0);

  const load = useCallback(() => {
    setLoading(true);
    api<{ data: JobRow[] }>('/api/admin/exports')
      .then((r) => {
        setJobs(r.data);
        setError('');
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
    const iv = setInterval(() => setTick((x) => x + 1), 15000); // โหลดซ้ำสม่ำเสมอกันรายการล้าสมัย
    return () => clearInterval(iv);
  }, [load, tick]);

  const create = async () => {
    setCreating(true);
    setError('');
    try {
      // สร้างไฟล์ทันที (synchronous) — รองรับเฉพาะรูปแบบ CSV
      await api('/api/admin/exports', { method: 'POST', body: JSON.stringify({ resource, format: 'csv' }) });
      setTick((x) => x + 1);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <AdminHeader />

      <main className="mx-auto w-full max-w-5xl flex-1 space-y-5 px-4 py-5">
        <div className="flex items-center justify-between gap-2">
          <h1 className="flex items-center gap-2 text-lg font-bold text-black">
            <Download className="h-5 w-5" aria-hidden /> ส่งออกข้อมูล
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

        {/* ฟอร์มสร้างงานส่งออก */}
        <section aria-label="สร้างงานส่งออก" className="space-y-3 rounded-3xl border border-line bg-white p-4 shadow-sm">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-neutral-500">ข้อมูลที่ต้องการส่งออก</span>
              <select value={resource} onChange={(e) => setResource(e.target.value)} className="h-11 w-full rounded-2xl border border-line bg-neutral-50 px-3 text-sm outline-none focus:border-[#FFC400]">
                <option value="orders">ออเดอร์</option>
                <option value="users">ผู้ใช้</option>
                <option value="restaurants">ร้านค้า</option>
                <option value="reviews">รีวิว</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-neutral-500">รูปแบบไฟล์</span>
              <select value="csv" disabled className="h-11 w-full rounded-2xl border border-line bg-neutral-50 px-3 text-sm text-neutral-400 outline-none">
                <option value="csv">CSV</option>
                <option value="xlsx" disabled>XLSX (รองรับ CSV)</option>
                <option value="json" disabled>JSON (รองรับ CSV)</option>
              </select>
            </label>
          </div>
          <button onClick={() => void create()} disabled={creating} className="btn-brand h-11 w-full text-sm disabled:opacity-50">
            {creating ? 'กำลังสร้างรายงาน…' : 'สร้างรายงาน'}
          </button>
          <p className="text-[11px] text-neutral-400">ระบบสร้างไฟล์ CSV ให้ทันที (สูงสุด 1,000 แถวล่าสุด) — เมื่อเสร็จแล้วกดดาวน์โหลดได้จากรายการด้านล่าง</p>
        </section>

        {/* รายการงาน */}
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-3xl bg-neutral-100" />
            ))}
          </div>
        ) : jobs.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-line px-4 py-10 text-center">
            <Download className="mx-auto h-8 w-8 text-neutral-300" aria-hidden />
            <p className="mt-2 text-sm text-neutral-400">ยังไม่มีงานส่งออกข้อมูล</p>
          </div>
        ) : (
          <ul className="overflow-hidden rounded-3xl border border-line bg-white">
            {jobs.map((j, i) => (
              <li key={j.id} className={`flex flex-wrap items-center gap-2 px-4 py-3 ${i > 0 ? 'border-t border-line' : ''}`}>
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-neutral-100">
                  <FileDown className="h-4 w-4 text-neutral-500" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-bold text-black">
                    {RESOURCE_TH[j.resource] ?? j.resource}
                    <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-bold uppercase text-neutral-500">{j.format}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${statusCls(j.status)}`}>{STATUS_TH[j.status] ?? j.status}</span>
                  </p>
                  <p className="truncate-1 text-[11px] text-neutral-400">
                    ขอโดย {j.requestedByName ?? '-'} ·{' '}
                    {new Date(j.created_at).toLocaleString('th-TH', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    {j.expires_at ? ` · ไฟล์หมดอายุ ${new Date(j.expires_at).toLocaleString('th-TH', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}` : ''}
                  </p>
                  {j.error_message && <p className="truncate-1 text-[11px] text-red-500">{j.error_message}</p>}
                </div>
                <span className="shrink-0 text-xs font-bold text-neutral-500">{j.progress ?? 0}%</span>
                {j.status === 'completed' && (
                  <a
                    href={`/api/admin/exports/${j.id}?download=1`}
                    className="flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-black px-3 text-xs font-bold text-[#FFC400] transition-transform active:scale-95"
                  >
                    <Download className="h-3.5 w-3.5" aria-hidden /> ดาวน์โหลด
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
      </main>

      <AdminFooter />
    </div>
  );
}
