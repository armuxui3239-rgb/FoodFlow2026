'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import {
  ArrowLeft,
  Bike,
  CheckCircle2,
  Circle,
  ClipboardList,
  CreditCard,
  MapPin,
  Store,
  User,
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { api, baht, STATUS_COLOR, STATUS_TH, useSession } from '@/lib/client';

interface OrderDetail {
  id: string;
  order_code: string;
  status: string;
  subtotal: number;
  delivery_fee: number;
  promotion_discount: number;
  total: number;
  payment_method: string;
  notes: string | null;
  cancelled_reason: string | null;
  estimated_prep_time_minutes: number | null;
  created_at: string;
  restaurant: { id: string; name: string; phone: string | null; address_line: string; city: string } | null;
  items: { id: string; name_snapshot: string; quantity: number; unit_price: number; notes: string | null }[];
  payment: { id: string; amount: number; method: string; status: string; paid_at: string | null } | null;
  address: { id: string; label: string; address_line: string } | null;
  customer: { id: string; full_name: string; email: string; phone: string | null } | null;
  driver: { id: string; full_name: string; email: string; phone: string | null } | null;
  driverProfile: { vehicle_type: string; vehicle_plate: string | null; rating: number } | null;
  statusHistory: { id: string; status: string; changed_by: string; note: string | null; created_at: string }[];
}

const TRANSITIONS: Record<string, string[]> = {
  created: ['cancelled'],
  pending_payment: ['cancelled'],
  paid: ['restaurant_pending', 'restaurant_accepted'],
  restaurant_pending: ['restaurant_accepted'],
  restaurant_accepted: ['preparing'],
  preparing: ['ready_for_pickup'],
  ready_for_pickup: ['driver_assigned'],
  driver_assigned: ['picked_up'],
  driver_arriving_restaurant: ['picked_up'],
  picked_up: ['delivering'],
  delivering: ['delivered'],
  delivered: ['completed'],
  completed: [],
};
const TERMINAL = ['cancelled', 'refunded'];
const PAYMENT_TH: Record<string, string> = { cash: 'เงินสด', promptpay: 'พร้อมเพย์' };
const PAY_STATUS_TH: Record<string, string> = { completed: 'ชำระแล้ว', pending: 'รอชำระ' };

/** หน้ารายละเอียดออเดอร์ (แอดมิน) — เปลี่ยนสถานะตามลำดับที่อนุญาต + ยกเลิกพร้อมเหตุผล + ไทม์ไลน์ */
export default function AdminOrderDetailPage() {
  useSession();
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [nextStatus, setNextStatus] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    api<{ order: OrderDetail }>(`/api/admin/orders/${id}`)
      .then((d) => {
        setOrder(d.order);
        setNextStatus('');
        setCancelReason('');
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(load, [load]);

  const options = order
    ? [
        ...(TRANSITIONS[order.status] ?? []),
        ...(!TERMINAL.includes(order.status) && !(TRANSITIONS[order.status] ?? []).includes('cancelled') ? ['cancelled'] : []),
      ]
    : [];

  const apply = async () => {
    setSaving(true);
    setError('');
    try {
      await api(`/api/admin/orders/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(nextStatus === 'cancelled' ? { status: 'cancelled', reason: cancelReason.trim() } : { status: nextStatus }),
      });
      setConfirmOpen(false);
      setLoading(true);
      load();
    } catch (e) {
      setError((e as Error).message);
      setConfirmOpen(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <header className="sticky top-0 z-40 border-b border-line bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-2 px-4">
          <Link
            href="/admin/orders"
            aria-label="ย้อนกลับ"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-neutral-100 transition-transform active:scale-95"
          >
            <ArrowLeft className="h-5 w-5" aria-hidden />
          </Link>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-black text-[#FFC400]">
            <ClipboardList className="h-5 w-5" aria-hidden />
          </span>
          <h1 className="truncate-1 text-sm font-bold text-black">ออเดอร์ {order?.order_code ?? '…'}</h1>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 space-y-4 px-4 py-5">
        {error && <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-24 animate-pulse rounded-3xl bg-neutral-100" />
            ))}
          </div>
        ) : !order ? (
          <p className="rounded-3xl border border-dashed border-line px-4 py-10 text-center text-sm text-neutral-300">ไม่พบคำสั่งซื้อ</p>
        ) : (
          <>
            {/* สรุปสถานะ + เปลี่ยนสถานะ */}
            <section className="rounded-3xl border border-line p-4" aria-label="สถานะออเดอร์">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className={`inline-block rounded-full px-3 py-1 text-xs font-bold ${STATUS_COLOR[order.status] ?? 'bg-neutral-100 text-neutral-700'}`}>
                    {STATUS_TH[order.status] ?? order.status}
                  </span>
                  <p className="mt-1 text-[11px] text-neutral-400">
                    {new Date(order.created_at).toLocaleString('th-TH', { dateStyle: 'long', timeStyle: 'short' })}
                    {order.cancelled_reason ? ` · เหตุผลยกเลิก: ${order.cancelled_reason}` : ''}
                  </p>
                </div>
                {options.length > 0 ? (
                  <div className="flex items-center gap-2">
                    <select
                      value={nextStatus}
                      onChange={(e) => setNextStatus(e.target.value)}
                      aria-label="เลือกสถานะใหม่"
                      className="h-10 rounded-2xl border border-line bg-neutral-50 px-3 text-sm outline-none focus:border-[#FFC400]"
                    >
                      <option value="">— เลือกสถานะใหม่ —</option>
                      {options.map((s) => (
                        <option key={s} value={s}>
                          {STATUS_TH[s] ?? s}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => setConfirmOpen(true)}
                      disabled={!nextStatus}
                      className="btn-brand h-10 px-4 text-xs disabled:opacity-50"
                    >
                      เปลี่ยนสถานะ
                    </button>
                  </div>
                ) : (
                  <p className="text-xs font-semibold text-neutral-400">ออเดอร์นี้จบการทำงานแล้ว เปลี่ยนสถานะต่อไม่ได้</p>
                )}
              </div>
            </section>

            {/* ลูกค้า / ร้าน / ไรเดอร์ */}
            <section className="grid gap-3 sm:grid-cols-3" aria-label="ผู้เกี่ยวข้อง">
              <div className="rounded-3xl border border-line p-4">
                <p className="flex items-center gap-1.5 text-xs font-bold text-neutral-500"><User className="h-4 w-4" aria-hidden /> ลูกค้า</p>
                <p className="mt-1 text-sm font-bold text-black">{order.customer?.full_name ?? '-'}</p>
                <p className="truncate-1 text-[11px] text-neutral-400">{order.customer?.email ?? '-'}</p>
                <p className="text-[11px] text-neutral-400">{order.customer?.phone ?? 'ไม่มีเบอร์โทร'}</p>
              </div>
              <div className="rounded-3xl border border-line p-4">
                <p className="flex items-center gap-1.5 text-xs font-bold text-neutral-500"><Store className="h-4 w-4" aria-hidden /> ร้าน</p>
                <p className="mt-1 text-sm font-bold text-black">{order.restaurant?.name ?? '-'}</p>
                <p className="text-[11px] text-neutral-400">{order.restaurant?.phone ?? 'ไม่มีเบอร์โทร'}</p>
                <p className="truncate-1 text-[11px] text-neutral-400">{order.restaurant?.address_line ?? ''} {order.restaurant?.city ?? ''}</p>
              </div>
              <div className="rounded-3xl border border-line p-4">
                <p className="flex items-center gap-1.5 text-xs font-bold text-neutral-500"><Bike className="h-4 w-4" aria-hidden /> ไรเดอร์</p>
                {order.driver ? (
                  <>
                    <p className="mt-1 text-sm font-bold text-black">{order.driver.full_name}</p>
                    <p className="text-[11px] text-neutral-400">{order.driver.phone ?? 'ไม่มีเบอร์โทร'}</p>
                    <p className="text-[11px] text-neutral-400">
                      {order.driverProfile ? `${order.driverProfile.vehicle_type} · ${order.driverProfile.vehicle_plate ?? 'ไม่มีป้ายทะเบียน'} · คะแนน ${Number(order.driverProfile.rating).toFixed(1)}` : ''}
                    </p>
                  </>
                ) : (
                  <p className="mt-1 text-sm text-neutral-300">ยังไม่มีไรเดอร์รับงาน</p>
                )}
              </div>
            </section>

            {/* ที่อยู่จัดส่ง */}
            {order.address && (
              <section className="rounded-3xl border border-line p-4" aria-label="ที่อยู่จัดส่ง">
                <p className="flex items-center gap-1.5 text-xs font-bold text-neutral-500"><MapPin className="h-4 w-4" aria-hidden /> ที่อยู่จัดส่ง ({order.address.label})</p>
                <p className="mt-1 text-sm text-black">{order.address.address_line}</p>
              </section>
            )}

            {/* รายการอาหาร + ยอดรวม */}
            <section className="rounded-3xl border border-line p-4" aria-label="รายการอาหาร">
              <h2 className="mb-2 text-sm font-bold text-black">รายการอาหาร ({order.items.length})</h2>
              <ul className="divide-y divide-line">
                {order.items.map((it) => (
                  <li key={it.id} className="flex items-center justify-between gap-2 py-2">
                    <div className="min-w-0">
                      <p className="truncate-1 text-sm text-black">{it.name_snapshot} × {it.quantity}</p>
                      {it.notes && <p className="truncate-1 text-[11px] text-neutral-400">หมายเหตุ: {it.notes}</p>}
                    </div>
                    <span className="shrink-0 text-sm font-semibold text-black">{baht(it.unit_price * it.quantity)}</span>
                  </li>
                ))}
              </ul>
              <dl className="mt-3 space-y-1 border-t border-line pt-3 text-sm">
                <div className="flex justify-between"><dt className="text-neutral-500">ค่าอาหาร</dt><dd>{baht(order.subtotal)}</dd></div>
                <div className="flex justify-between"><dt className="text-neutral-500">ค่าส่ง</dt><dd>{baht(order.delivery_fee)}</dd></div>
                {order.promotion_discount > 0 && (
                  <div className="flex justify-between text-red-600"><dt>ส่วนลดคูปอง</dt><dd>-{baht(order.promotion_discount)}</dd></div>
                )}
                <div className="flex justify-between font-bold text-black"><dt>ยอดรวม</dt><dd>{baht(order.total)}</dd></div>
              </dl>
              {order.notes && <p className="mt-2 rounded-2xl bg-[#FFF4CC] px-3 py-2 text-xs text-black">โน้ตจากลูกค้า: {order.notes}</p>}
            </section>

            {/* การชำระเงิน */}
            <section className="rounded-3xl border border-line p-4" aria-label="การชำระเงิน">
              <p className="flex items-center gap-1.5 text-xs font-bold text-neutral-500"><CreditCard className="h-4 w-4" aria-hidden /> การชำระเงิน</p>
              {order.payment ? (
                <p className="mt-1 text-sm text-black">
                  {PAYMENT_TH[order.payment.method] ?? order.payment.method} ·{' '}
                  <span className={`font-bold ${order.payment.status === 'completed' ? 'text-black' : 'text-[#b45309]'}`}>
                    {PAY_STATUS_TH[order.payment.status] ?? order.payment.status}
                  </span>{' '}
                  · {baht(order.payment.amount)}
                  {order.payment.paid_at ? ` · จ่ายเมื่อ ${new Date(order.payment.paid_at).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })}` : ''}
                </p>
              ) : (
                <p className="mt-1 text-sm text-neutral-300">ยังไม่มีรายการชำระเงิน</p>
              )}
            </section>

            {/* ไทม์ไลน์สถานะ */}
            <section className="rounded-3xl border border-line p-4" aria-label="ประวัติการเปลี่ยนสถานะ">
              <h2 className="mb-3 text-sm font-bold text-black">ไทม์ไลน์สถานะ</h2>
              {order.statusHistory.length === 0 ? (
                <p className="py-2 text-center text-sm text-neutral-300">ยังไม่มีประวัติการเปลี่ยนสถานะ</p>
              ) : (
                <ol className="space-y-3">
                  {order.statusHistory.map((h, i) => (
                    <li key={h.id} className="flex items-start gap-3">
                      <span className="mt-0.5 shrink-0">
                        {i === order.statusHistory.length - 1 ? (
                          <CheckCircle2 className="h-5 w-5 text-black" aria-hidden />
                        ) : (
                          <Circle className="h-5 w-5 text-neutral-300" aria-hidden />
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-black">{STATUS_TH[h.status] ?? h.status}</p>
                        <p className="truncate-1 text-[11px] text-neutral-400">
                          {h.changed_by} · {new Date(h.created_at).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })}
                          {h.note ? ` · ${h.note}` : ''}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
              <p className="mt-3 text-[11px] text-neutral-400">การเปลี่ยนสถานะทุกครั้งจะถูกบันทึกลงบันทึกการทำงานของแอดมิน</p>
            </section>
          </>
        )}
      </main>

      {/* ยืนยันการเปลี่ยนสถานะ */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle>ยืนยันเปลี่ยนสถานะเป็น “{STATUS_TH[nextStatus] ?? nextStatus}”?</AlertDialogTitle>
            <AlertDialogDescription>
              การเปลี่ยนสถานะจะบันทึกประวัติและบันทึกการทำงานของแอดมินทันที
              {nextStatus === 'cancelled' && ' การยกเลิกต้องระบุเหตุผลเพื่อประวัติที่โปร่งใส'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {nextStatus === 'cancelled' && (
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-neutral-500">เหตุผลการยกเลิก (จำเป็น)</span>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                rows={3}
                placeholder="เช่น ร้านปิดกะทันหัน ลูกค้าขอยกเลิก"
                className="w-full rounded-2xl border border-line bg-neutral-50 px-3 py-2 text-sm outline-none focus:border-[#FFC400]"
              />
            </label>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full">ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (nextStatus === 'cancelled' && !cancelReason.trim()) return;
                void apply();
              }}
              disabled={saving || (nextStatus === 'cancelled' && !cancelReason.trim())}
              className="rounded-full disabled:opacity-50"
            >
              {saving ? 'กำลังบันทึก…' : 'ยืนยัน'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <footer className="mt-auto border-t border-line bg-white pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-4 text-center text-xs text-neutral-400">
        © {new Date().getFullYear()} ฟู๊ด ธันเดอร์ — ศูนย์ควบคุมผู้ดูแลระบบ
      </footer>
    </div>
  );
}
