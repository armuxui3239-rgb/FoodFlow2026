'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, ClipboardList, LifeBuoy, Send, UserRound, Zap } from 'lucide-react';
import { api } from '@/lib/client';
import { AdminSubShell } from '@/components/portal/admin-header';

interface Ticket {
  id: string;
  order_id: string | null;
  issue_type: string;
  summary: string;
  priority: string;
  status: string;
  assigned_admin_id: string | null;
  assignedAdminName: string | null;
  resolution_notes: string | null;
  created_at: string;
  resolved_at: string | null;
  channel: string | null;
  userName: string;
  userEmail: string;
}

interface MessageRow {
  id: string;
  sender_id: string | null;
  body: string;
  senderName: string;
  senderRole: string;
  created_at: string;
}

interface RelatedOrder {
  id: string;
  order_code: string;
  status: string;
  total: number;
  restaurantName: string;
  created_at?: string;
}

interface DetailData {
  ticket: Ticket;
  messages: MessageRow[];
  order: RelatedOrder | null;
}

interface MacroRow {
  id: string;
  name: string;
  body: string;
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

/** หน้ารายละเอียดตั๋ว — รับเรื่อง / ตอบกลับ (แมโครสำเร็จรูป) / ทำเครื่องหมายแก้ไขแล้ว */
export default function AdminSupportDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<DetailData | null>(null);
  const [macros, setMacros] = useState<MacroRow[]>([]);
  const [notes, setNotes] = useState('');
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    if (!id) return;
    setLoading(true);
    api<DetailData>(`/api/admin/support-tickets/${id}`)
      .then((r) => {
        setData(r);
        setNotes(r.ticket.resolution_notes ?? '');
        setError('');
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
    api<{ data: MessageRow[] }>(`/api/admin/support-tickets/${id}/replies`)
      .then((r) => setData((d) => (d ? { ...d, messages: r.data } : d)))
      .catch(() => undefined);
  }, [id]);

  useEffect(() => {
    load();
    api<{ data: MacroRow[] }>('/api/admin/support-macros')
      .then((r) => setMacros(r.data))
      .catch(() => undefined); // แมโครโหลดไม่ได้ก็ใช้งานหน้าได้ปกติ
  }, [load]);

  const patch = async (body: Record<string, unknown>) => {
    setBusy(true);
    setError('');
    try {
      await api(`/api/admin/support-tickets/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
      load();
    } catch (e) {
      // เช่น enum TicketStatus ฝั่งฐานข้อมูลจริงยังมีแค่ 'open' — API จะคืนข้อความเตือนภาษาไทยให้แสดง
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const sendReply = async () => {
    if (!reply.trim()) return;
    setSending(true);
    setError('');
    try {
      await api(`/api/admin/support-tickets/${id}/replies`, { method: 'POST', body: JSON.stringify({ body: reply }) });
      setReply('');
      api<{ data: MessageRow[] }>(`/api/admin/support-tickets/${id}/replies`)
        .then((r) => setData((d) => (d ? { ...d, messages: r.data } : d)))
        .catch(() => undefined);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSending(false);
    }
  };

  const ticket = data?.ticket;

  return (
    <AdminSubShell
      title="รายละเอียดตั๋ว"
      subtitle={ticket ? `${ISSUE_TH[ticket.issue_type] ?? ticket.issue_type} · ${STATUS_TH_LOCAL[ticket.status] ?? ticket.status}` : ''}
      backHref="/admin/support"
      Icon={LifeBuoy}
    >
      {error && (
        <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </p>
      )}

      {loading ? (
        <div className="space-y-3">
          <div className="h-40 animate-pulse rounded-3xl bg-neutral-100" />
          <div className="h-40 animate-pulse rounded-3xl bg-neutral-100" />
        </div>
      ) : !ticket ? (
        <div className="rounded-3xl border border-dashed border-line px-4 py-10 text-center">
          <LifeBuoy className="mx-auto h-8 w-8 text-neutral-300" aria-hidden />
          <p className="mt-2 text-sm text-neutral-400">ไม่พบตั๋วนี้</p>
        </div>
      ) : (
        <>
          {/* รายละเอียดปัญหา */}
          <section aria-label="รายละเอียดปัญหา" className="rounded-3xl border border-line bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-[11px] font-bold text-neutral-600">
                {ISSUE_TH[ticket.issue_type] ?? ticket.issue_type}
              </span>
              {(ticket.priority === 'high' || ticket.priority === 'urgent') && (
                <span className="rounded-full bg-red-50 px-2.5 py-1 text-[11px] font-bold text-red-600">ความสำคัญสูง</span>
              )}
              <span className="rounded-full bg-[#FFF4CC] px-2.5 py-1 text-[11px] font-bold text-black">
                {STATUS_TH_LOCAL[ticket.status] ?? ticket.status}
              </span>
              {ticket.channel && <span className="text-[11px] text-neutral-400">ช่องทาง: {ticket.channel}</span>}
            </div>
            <p className="mt-3 whitespace-pre-wrap text-sm text-neutral-700">{ticket.summary}</p>
            <p className="mt-2 text-[11px] text-neutral-400">
              แจ้งเมื่อ {new Date(ticket.created_at).toLocaleString('th-TH', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              {ticket.resolved_at &&
                ` · แก้ไขเมื่อ ${new Date(ticket.resolved_at).toLocaleString('th-TH', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`}
            </p>
          </section>

          {/* ข้อมูลผู้แจ้ง + ออเดอร์ที่เกี่ยวข้อง */}
          <section aria-label="ผู้แจ้ง" className="flex items-start gap-3 rounded-3xl border border-line bg-white p-4 shadow-sm">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-neutral-100">
              <UserRound className="h-5 w-5 text-neutral-500" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate-1 text-sm font-bold text-black">{ticket.userName ?? 'ไม่ทราบชื่อ'}</p>
              <p className="truncate-1 text-xs text-neutral-400">{ticket.userEmail ?? '-'}</p>
              {ticket.assignedAdminName && (
                <p className="mt-0.5 text-[11px] text-neutral-400">ผู้รับผิดชอบ: {ticket.assignedAdminName}</p>
              )}
            </div>
            {data?.order && (
              <Link
                href={`/admin/orders/${data.order.id}`}
                className="flex shrink-0 items-center gap-1 rounded-full bg-neutral-50 px-3 py-2 text-[11px] font-semibold text-neutral-600 transition-colors hover:bg-neutral-100"
              >
                <ClipboardList className="h-3.5 w-3.5" aria-hidden /> ออเดอร์ {data.order.order_code}
              </Link>
            )}
          </section>

          {/* ออเดอร์ที่เกี่ยวข้อง (สรุปสั้น) */}
          {data?.order && (
            <section aria-label="ออเดอร์ที่เกี่ยวข้อง" className="rounded-3xl border border-line bg-white p-4 shadow-sm">
              <h2 className="text-sm font-bold text-black">ออเดอร์ที่เกี่ยวข้อง</h2>
              <p className="mt-1 text-xs text-neutral-500">
                {data.order.order_code} · {data.order.restaurantName} · {data.order.created_at ? new Date(data.order.created_at).toLocaleDateString('th-TH') : ''}
              </p>
            </section>
          )}

          {/* บทสนทนา */}
          <section aria-label="บทสนทนา" className="space-y-3 rounded-3xl border border-line bg-white p-4 shadow-sm">
            <h2 className="text-sm font-bold text-black">บทสนทนา</h2>
            {(data?.messages ?? []).length === 0 ? (
              <p className="text-xs text-neutral-400">ยังไม่มีข้อความในตั๋วนี้</p>
            ) : (
              <ul className="space-y-2">
                {(data?.messages ?? []).map((m) => (
                  <li key={m.id} className="rounded-2xl bg-neutral-50 px-3 py-2">
                    <p className="flex flex-wrap items-center gap-2 text-[11px] font-semibold text-neutral-500">
                      {m.senderName}
                      <span className="rounded-full bg-white px-1.5 py-0.5 text-[10px] font-bold text-neutral-400">{m.senderRole}</span>
                      <span className="ml-auto font-normal">
                        {new Date(m.created_at).toLocaleString('th-TH', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-neutral-700">{m.body}</p>
                  </li>
                ))}
              </ul>
            )}

            {/* ช่องตอบกลับ + แมโครสำเร็จรูป */}
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-neutral-500">ตอบกลับผู้แจ้ง</span>
              <textarea
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                rows={3}
                placeholder="พิมพ์ข้อความตอบกลับ"
                className="w-full rounded-2xl border border-line bg-white px-4 py-3 text-sm text-black outline-none focus:border-black"
              />
            </label>
            {macros.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {macros.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setReply(m.body)}
                    className="flex h-8 items-center gap-1 rounded-full bg-[#FFF4CC] px-3 text-[11px] font-bold text-black transition-colors hover:bg-[#FFC400]"
                    title={m.body}
                  >
                    <Zap className="h-3 w-3" aria-hidden /> {m.name}
                  </button>
                ))}
              </div>
            )}
            <button
              onClick={() => void sendReply()}
              disabled={sending || !reply.trim()}
              className="flex h-11 w-full items-center justify-center gap-1.5 rounded-full bg-black text-sm font-bold text-white transition-transform active:scale-95 disabled:opacity-50"
            >
              <Send className="h-4 w-4" aria-hidden /> {sending ? 'กำลังส่ง…' : 'ส่งข้อความ'}
            </button>
          </section>

          {/* บันทึกการแก้ไข + ปุ่มดำเนินการ */}
          <section aria-label="ดำเนินการตั๋ว" className="space-y-3 rounded-3xl border border-line bg-white p-4 shadow-sm">
            <h2 className="text-sm font-bold text-black">ดำเนินการ</h2>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-neutral-500">บันทึกการแก้ไข</span>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="อธิบายวิธีแก้ไขปัญหานี้"
                className="w-full rounded-2xl border border-line bg-white px-4 py-3 text-sm text-black outline-none focus:border-black"
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => void patch({ assignSelf: true })}
                disabled={busy || Boolean(ticket.assigned_admin_id)}
                className="btn-brand h-11 flex-1 text-sm disabled:opacity-50"
              >
                {ticket.assigned_admin_id ? `ผู้รับผิดชอบ: ${ticket.assignedAdminName ?? 'มีแล้ว'}` : 'รับเรื่อง'}
              </button>
              <button
                onClick={() => void patch({ status: 'resolved', resolutionNotes: notes })}
                disabled={busy || ticket.status === 'resolved' || ticket.status === 'closed' || !notes.trim()}
                className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-full bg-black text-sm font-bold text-white transition-transform active:scale-95 disabled:opacity-50"
              >
                <CheckCircle2 className="h-4 w-4" aria-hidden /> ทำเครื่องหมายแก้ไขแล้ว
              </button>
            </div>
            {!notes.trim() && ticket.status !== 'resolved' && ticket.status !== 'closed' && (
              <p className="text-[11px] text-neutral-400">กรอกบันทึกการแก้ไขก่อนปิดเรื่อง — หากฐานข้อมูลยังไม่รองรับสถานะอื่นนอกจาก &quot;open&quot; ระบบจะแจ้งเตือนเมื่อบันทึก</p>
            )}
          </section>
        </>
      )}
    </AdminSubShell>
  );
}
