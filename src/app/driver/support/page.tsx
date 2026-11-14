'use client';

import { useCallback, useEffect, useState } from 'react';
import { LifeBuoy, Plus, Send } from 'lucide-react';
import { api } from '@/lib/client';
import { DriverFooter, DriverHeader } from '@/components/portal/driver-header';

interface Ticket {
  id: string;
  issue_type: string;
  summary: string;
  status: string;
  resolution_notes: string | null;
  created_at: string;
  resolved_at: string | null;
}

// enum TicketIssueType จริงรองรับครบ 6 หมวด
const ISSUES: { value: string; label: string }[] = [
  { value: 'late_delivery', label: 'ส่งช้า / ปัญหาการจัดส่ง' },
  { value: 'wrong_item', label: 'ได้รับสินค้าผิด' },
  { value: 'missing_item', label: 'สินค้าขาด / หาย' },
  { value: 'driver_issue', label: 'ปัญหาบัญชีไรเดอร์' },
  { value: 'refund_request', label: 'ขอเงินคืน' },
  { value: 'other', label: 'อื่น ๆ' },
];

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  open: { label: 'กำลังดำเนินการ', cls: 'bg-[#FFF4CC] text-black' },
  in_progress: { label: 'กำลังดำเนินการ', cls: 'bg-[#FFF4CC] text-black' },
  resolved: { label: 'แก้ไขแล้ว', cls: 'bg-black text-[#FFC400]' },
  closed: { label: 'ปิดเรียบร้อย', cls: 'bg-neutral-100 text-neutral-500' },
};

const fmt = (iso: string) =>
  new Date(iso).toLocaleString('th-TH', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

export default function DriverSupportPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // ฟอร์มแจ้งปัญหา
  const [issueType, setIssueType] = useState(ISSUES[0].value);
  const [summary, setSummary] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    api<{ data: Ticket[] }>('/api/driver/support')
      .then((r) => setTickets(r.data))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  const submit = async () => {
    setSaving(true);
    setError('');
    setNotice('');
    try {
      await api('/api/driver/support', {
        method: 'POST',
        body: JSON.stringify({ issue_type: issueType, summary: summary.trim() }),
      });
      setSummary('');
      setNotice('ส่งเรื่องแจ้งเหตุเรียบร้อยแล้ว ทีมงานจะติดต่อกลับโดยเร็ว');
      load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <DriverHeader />

      <main className="mx-auto w-full max-w-5xl flex-1 space-y-5 px-4 py-5">
        <h1 className="flex items-center gap-2 text-lg font-bold text-black">
          <LifeBuoy className="h-5 w-5" aria-hidden /> ศูนย์ช่วยเหลือ
        </h1>

        {error && (
          <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </p>
        )}
        {notice && <p className="rounded-2xl bg-[#FFF4CC] px-4 py-3 text-sm text-neutral-700">{notice}</p>}

        {/* ฟอร์มแจ้งปัญหา */}
        <section aria-label="แจ้งปัญหา" className="rounded-3xl border border-line p-5">
          <h2 className="mb-3 flex items-center gap-1.5 text-sm font-bold text-black">
            <Plus className="h-4 w-4" aria-hidden /> แจ้งปัญหาใหม่
          </h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
            className="space-y-3"
          >
            <label className="block">
              <span className="text-xs font-semibold text-neutral-500">หัวข้อปัญหา</span>
              <select
                value={issueType}
                onChange={(e) => setIssueType(e.target.value)}
                className="mt-1 h-11 w-full rounded-2xl border border-line bg-neutral-50 px-3 text-sm text-black outline-none focus:border-[#FFC400]"
              >
                {ISSUES.map((i) => (
                  <option key={i.value} value={i.value}>
                    {i.label}
                  </option>
                ))}
              </select>
              <span className="mt-1 block text-[11px] text-neutral-400">
                ขณะนี้ระบบเปิดแจ้งได้เฉพาะหัวข้อนี้ — หมวดอื่น (สินค้าผิด ขาดรายการ ขอคืนเงิน ฯลฯ) ต้องรัน SQL migration เพิ่มค่า enum ในฐานข้อมูลก่อนจึงจะเปิดให้เลือกได้
              </span>
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-neutral-500">รายละเอียด</span>
              <textarea
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                rows={4}
                required
                placeholder="อธิบายปัญหาของคุณ เช่น หมายเลขออเดอร์ และสิ่งที่เกิดขึ้น"
                className="mt-1 w-full rounded-2xl border border-line bg-neutral-50 px-3 py-2.5 text-sm text-black outline-none placeholder:text-neutral-400 focus:border-[#FFC400]"
              />
            </label>
            <button type="submit" disabled={saving} className="btn-brand h-11 w-full rounded-full text-sm font-bold disabled:opacity-50">
              <span className="inline-flex items-center gap-2">
                <Send className="h-4 w-4" aria-hidden /> {saving ? 'กำลังส่ง...' : 'ส่งเรื่องแจ้งเหตุ'}
              </span>
            </button>
          </form>
        </section>

        {/* รายการตั๋วของฉัน */}
        <section aria-label="เรื่องแจ้งเหตุของฉัน">
          <h2 className="mb-2 text-sm font-bold text-black">เรื่องแจ้งเหตุของฉัน</h2>
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="h-20 animate-pulse rounded-3xl bg-neutral-100" />
              ))}
            </div>
          ) : tickets.length === 0 ? (
            <p className="rounded-3xl border border-dashed border-line px-4 py-6 text-center text-sm text-neutral-300">
              ยังไม่มีเรื่องแจ้งเหตุ — หากพบปัญหาสามารถแจ้งได้จากฟอร์มด้านบน
            </p>
          ) : (
            <ul className="space-y-2">
              {tickets.map((t) => {
                const badge = STATUS_BADGE[t.status] ?? { label: t.status, cls: 'bg-neutral-100 text-neutral-700' };
                const issueLabel = ISSUES.find((i) => i.value === t.issue_type)?.label ?? t.issue_type;
                return (
                  <li key={t.id} className="rounded-3xl border border-line bg-white p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-bold text-black">{issueLabel}</span>
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${badge.cls}`}>{badge.label}</span>
                    </div>
                    <p className="mt-1 text-sm text-neutral-700">{t.summary}</p>
                    <p className="mt-1 text-[11px] text-neutral-400">แจ้งเมื่อ {fmt(t.created_at)}</p>
                    {t.status === 'resolved' && t.resolution_notes && (
                      <p className="mt-2 rounded-2xl bg-[#FFF4CC] px-3 py-2 text-xs text-neutral-700">
                        การแก้ไข: {t.resolution_notes}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </main>

      <DriverFooter />
    </div>
  );
}
