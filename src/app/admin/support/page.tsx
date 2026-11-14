'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { LifeBuoy, RefreshCw } from 'lucide-react';
import { api } from '@/lib/client';
import { AdminFooter, AdminHeader } from '@/components/portal/admin-header';

interface TicketRow {
  id: string;
  order_id: string | null;
  issue_type: string;
  summary: string;
  priority: string;
  status: string;
  created_at: string;
  channel: string | null;
  userName: string;
  userEmail: string;
}

const ISSUE_TH: Record<string, string> = {
  late_delivery: 'ส่งช้า',
  wrong_item: 'สินค้าผิด',
  missing_item: 'ขาดรายการ',
  driver_issue: 'ปัญหาไรเดอร์',
  refund_request: 'ขอคืนเงิน',
  other: 'อื่น ๆ',
};

const STATUS_TH_LOCAL: Record<string, string> = {
  open: 'รอดำเนินการ',
  in_progress: 'กำลังดำเนินการ',
  resolved: 'แก้ไขแล้ว',
  closed: 'ปิดเรื่อง',
};

type TabKey = 'all' | 'open' | 'in_progress' | 'resolved';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'all', label: 'ทั้งหมด' },
  { key: 'open', label: 'รอดำเนินการ' },
  { key: 'in_progress', label: 'กำลังดำเนินการ' },
  { key: 'resolved', label: 'แก้ไขแล้ว' },
];

function PriorityBadge({ priority }: { priority: string }) {
  if (priority === 'high') {
    return <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-600">สูง</span>;
  }
  if (priority === 'normal' || priority === 'medium') {
    return <span className="rounded-full bg-[#FFF4CC] px-2 py-0.5 text-[10px] font-bold text-black">ปกติ</span>;
  }
  return <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-bold text-neutral-500">ต่ำ</span>;
}

function StatusBadge({ status }: { status: string }) {
  const cls =
    status === 'open'
      ? 'bg-black text-[#FFC400]'
      : status === 'in_progress'
        ? 'bg-[#FFC400] text-black'
        : 'bg-neutral-100 text-neutral-500';
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${cls}`}>{STATUS_TH_LOCAL[status] ?? status}</span>;
}

/** หน้าตั๋วซัพพอร์ต — แท็บตามสถานะ (กรองในเครื่อง) + รายการล่าสุด 50 รายการ */
export default function AdminSupportPage() {
  const [tab, setTab] = useState<TabKey>('all');
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    api<{ data: TicketRow[] }>('/api/admin/support-tickets')
      .then((r) => {
        setTickets(r.data);
        setError('');
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const t = setTimeout(load, 0); // หน่วงออกจาก effect body กัน cascading render
    return () => clearTimeout(t);
  }, [load]);

  const filtered = tab === 'all' ? tickets : tickets.filter((t) => t.status === tab);

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <AdminHeader />

      <main className="mx-auto w-full max-w-6xl flex-1 space-y-4 px-4 py-5">
        <div className="flex items-center justify-between gap-2">
          <h1 className="flex items-center gap-2 text-lg font-bold text-black">
            <LifeBuoy className="h-5 w-5" aria-hidden /> ซัพพอร์ตลูกค้า
          </h1>
          <button
            onClick={() => load()}
            className="flex items-center gap-1.5 rounded-full border border-line px-3 py-2 text-xs font-semibold text-neutral-600 transition-colors hover:bg-neutral-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} aria-hidden /> รีเฟรช
          </button>
        </div>

        {/* แท็บสถานะ */}
        <div role="tablist" aria-label="กรองตั๋วตามสถานะ" className="flex gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {TABS.map((t) => (
            <button
              key={t.key}
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => setTab(t.key)}
              className={`flex h-9 shrink-0 items-center rounded-full px-3.5 text-xs font-bold transition-colors ${
                tab === t.key ? 'bg-[#FFC400] text-black' : 'bg-neutral-100 text-neutral-600 hover:bg-[#FFF4CC]'
              }`}
            >
              {t.label}
            </button>
          ))}
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
        ) : filtered.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-line px-4 py-10 text-center">
            <LifeBuoy className="mx-auto h-8 w-8 text-neutral-300" aria-hidden />
            <p className="mt-2 text-sm text-neutral-400">ไม่มีตั๋วในสถานะนี้</p>
          </div>
        ) : (
          <ul className="overflow-hidden rounded-3xl border border-line bg-white">
            {filtered.map((t, i) => (
              <li key={t.id} className={i > 0 ? 'border-t border-line' : ''}>
                <Link href={`/admin/support/${t.id}`} className="block px-4 py-3 transition-colors hover:bg-[#FFFDF2]">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-bold text-neutral-600">
                      {ISSUE_TH[t.issue_type] ?? t.issue_type}
                    </span>
                    <PriorityBadge priority={t.priority} />
                    <StatusBadge status={t.status} />
                    <span className="ml-auto text-[11px] text-neutral-400">
                      {new Date(t.created_at).toLocaleString('th-TH', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="mt-1 truncate-1 text-sm font-semibold text-black">{t.summary}</p>
                  <p className="truncate-1 text-[11px] text-neutral-400">
                    ผู้แจ้ง: {t.userName ?? 'ไม่ทราบชื่อ'}
                    {t.order_id ? ' · มีออเดอร์ที่เกี่ยวข้อง' : ''}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>

      <AdminFooter />
    </div>
  );
}
