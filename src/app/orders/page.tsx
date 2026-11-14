'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import {
  CircleCheck,
  Clock,
  ReceiptText,
  Utensils,
  X,
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
import { api, baht, STATUS_COLOR, STATUS_TH } from '@/lib/client';

interface Order {
  id: string;
  order_code: string;
  status: string;
  total: number;
  created_at: string;
  restaurants: { name: string; logo_url: string | null } | null;
}

type OrderTab = 'active' | 'completed' | 'cancelled';

/** สถานะที่ยังดำเนินการอยู่ */
const ACTIVE_STATUSES = [
  'created',
  'pending_payment',
  'paid',
  'restaurant_pending',
  'restaurant_accepted',
  'preparing',
  'ready_for_pickup',
  'driver_assigned',
  'driver_arriving_restaurant',
  'picked_up',
  'delivering',
];
/** สถานะสำเร็จ */
const COMPLETED_STATUSES = ['delivered', 'completed', 'refunded'];
/** สถานะที่ลูกค้ากดยกเลิกเองได้ */
const CANCELLABLE_STATUSES = ['created', 'pending_payment', 'restaurant_pending'];

const TABS: { key: OrderTab; label: string }[] = [
  { key: 'active', label: 'กำลังดำเนินการ' },
  { key: 'completed', label: 'สำเร็จ' },
  { key: 'cancelled', label: 'ยกเลิก' },
];

const TAB_EMPTY: Record<OrderTab, { Icon: typeof Clock; title: string; cta: boolean }> = {
  active: { Icon: Clock, title: 'ไม่มีคำสั่งซื้อที่กำลังดำเนินการ', cta: true },
  completed: { Icon: CircleCheck, title: 'ยังไม่มีคำสั่งซื้อที่สำเร็จ', cta: false },
  cancelled: { Icon: X, title: 'ยังไม่มีคำสั่งซื้อที่ถูกยกเลิก', cta: false },
};

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<OrderTab>('active');
  const [cancelTarget, setCancelTarget] = useState<Order | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [actionError, setActionError] = useState('');
  // เหตุผลยกเลิกจากตารางที่แอดมินจัดการ (v4 ข้อ 8.11)
  const [cancelReasons, setCancelReasons] = useState<{ id: string; label: string }[]>([]);
  const [cancelReasonId, setCancelReasonId] = useState('');

  // ดึงข้อมูลครั้งเดียว แล้วกรองด้วยแท็บปัจจุบันฝั่ง client (เรียกซ้ำหลังยกเลิกสำเร็จ)
  const load = useCallback(async () => {
    try {
      const r = await api<{ data: Order[] }>('/api/orders');
      setOrders(r.data);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'โหลดคำสั่งซื้อไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // ดึงเหตุผลยกเลิกเมื่อเปิด dialog (จากตารางที่แอดมินจัดการ — v4 ข้อ 8.11)
  useEffect(() => {
    if (!cancelTarget || cancelReasons.length > 0) return;
    api<{ data: { id: string; label: string }[] }>('/api/cancellation-reasons')
      .then((r) => setCancelReasons(r.data ?? []))
      .catch(() => setCancelReasons([]));
  }, [cancelTarget, cancelReasons.length]);

  const confirmCancel = async () => {
    if (!cancelTarget) return;
    if (!cancelReasonId) {
      setActionError('กรุณาเลือกเหตุผลการยกเลิก');
      return;
    }
    setCancelling(true);
    setActionError('');
    try {
      await api(`/api/orders/${cancelTarget.id}/cancel`, { method: 'POST', body: JSON.stringify({ reasonId: cancelReasonId }) });
      setCancelTarget(null);
      setCancelReasonId('');
      await load();
    } catch (e) {
      setCancelTarget(null);
      setActionError(e instanceof Error ? e.message : 'ยกเลิกคำสั่งซื้อไม่สำเร็จ');
    } finally {
      setCancelling(false);
    }
  };

  if (loading) return <div className="h-64 animate-pulse rounded-3xl bg-neutral-100" />;
  if (error) return <p className="py-16 text-center text-sm text-red-500">{error}</p>;
  // หมายเหตุ: ไม่ return empty ก่อนแท็บ — ให้แท็บแสดงเสมอตามต้นแบบ และใช้สถานะ empty ต่อแท็บด้านล่าง

  const filtered = orders.filter((o) =>
    tab === 'active'
      ? ACTIVE_STATUSES.includes(o.status)
      : tab === 'completed'
        ? COMPLETED_STATUSES.includes(o.status)
        : o.status === 'cancelled',
  );
  const counts: Record<OrderTab, number> = {
    active: orders.filter((o) => ACTIVE_STATUSES.includes(o.status)).length,
    completed: orders.filter((o) => COMPLETED_STATUSES.includes(o.status)).length,
    cancelled: orders.filter((o) => o.status === 'cancelled').length,
  };

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-black">คำสั่งซื้อของฉัน</h1>

      {actionError && (
        <div
          role="alert"
          className="flex items-center justify-between gap-2 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-500"
        >
          <span>{actionError}</span>
          <button
            type="button"
            aria-label="ปิดข้อความแจ้งเตือน"
            onClick={() => setActionError('')}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full hover:bg-red-100"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
      )}

      {/* แท็บ 3 หมวด — กรองจากข้อมูลชุดเดียวฝั่ง client */}
      <div role="tablist" aria-label="หมวดคำสั่งซื้อ" className="flex rounded-full bg-neutral-100 p-1">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            data-testid={`orders-tab-${key}`}
            onClick={() => setTab(key)}
            className={`flex h-11 flex-1 items-center justify-center gap-1.5 rounded-full text-xs font-semibold transition-colors sm:text-sm ${
              tab === key ? 'bg-black text-[#FFC400]' : 'text-neutral-500 hover:text-black'
            }`}
          >
            {label}
            <span className="tabular-nums">({counts[key]})</span>
          </button>
        ))}
      </div>

      <div role="tabpanel" aria-label={TABS.find((t) => t.key === tab)?.label}>
        {filtered.length === 0 ? (
          // สถานะ empty ต่อแท็บ
          <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-line bg-white py-12 text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-neutral-100">
              {(() => {
                const { Icon } = TAB_EMPTY[tab];
                return <Icon className="h-8 w-8 text-neutral-300" aria-hidden />;
              })()}
            </span>
            <p className="text-sm text-neutral-400">{TAB_EMPTY[tab].title}</p>
            {TAB_EMPTY[tab].cta && (
              <Link href="/" className="btn-brand inline-flex h-11 items-center px-6 text-sm">
                สั่งอาหารเลย
              </Link>
            )}
          </div>
        ) : (
          <ul className="space-y-3">
            {filtered.map((o) => {
              const cancellable =
                tab === 'active' && CANCELLABLE_STATUSES.includes(o.status);
              return (
                <li key={o.id}>
                  <div className="overflow-hidden rounded-3xl border border-line bg-white shadow-sm">
                    <Link
                      href={`/orders/${o.id}`}
                      className="flex items-center gap-3 p-4 transition-colors hover:bg-[#FFF4CC]/40"
                    >
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#FFC400] text-black">
                        <Utensils className="h-6 w-6" aria-hidden />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate-1 text-sm font-bold text-black">{o.restaurants?.name ?? 'ร้านอาหาร'}</p>
                        <p className="truncate-1 text-xs text-neutral-400">
                          #{o.order_code} ·{' '}
                          {new Date(o.created_at).toLocaleDateString('th-TH', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                            timeZone: 'Asia/Bangkok',
                          })}
                        </p>
                      </div>
                      <div className="shrink-0 space-y-1 text-right">
                        <span className={`inline-block rounded-full px-2.5 py-1 text-[11px] font-bold ${STATUS_COLOR[o.status] ?? 'bg-neutral-100'}`}>
                          {STATUS_TH[o.status] ?? o.status}
                        </span>
                        <p className="text-sm font-bold tabular-nums text-black">{baht(o.total)}</p>
                      </div>
                    </Link>
                    {cancellable && (
                      <div className="flex items-center justify-between gap-2 border-t border-line px-4 py-2">
                        <span className="truncate-1 text-[11px] text-neutral-400">
                          ยกเลิกได้ก่อนร้านตอบรับออเดอร์
                        </span>
                        <button
                          type="button"
                          data-testid={`cancel-order-${o.order_code}`}
                          onClick={() => setCancelTarget(o)}
                          className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full border border-red-200 px-4 text-xs font-semibold text-red-500 transition-colors hover:bg-red-50"
                        >
                          <X className="h-3.5 w-3.5" aria-hidden />
                          ยกเลิก
                        </button>
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* ยืนยันการยกเลิกคำสั่งซื้อ */}
      <AlertDialog
        open={cancelTarget !== null}
        onOpenChange={(open) => {
          if (!open) setCancelTarget(null);
        }}
      >
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle>เลือกเหตุผลการยกเลิก</AlertDialogTitle>
            <AlertDialogDescription>
              ยกเลิกคำสั่งซื้อ #{cancelTarget?.order_code} — เลือกเหตุผลเพื่อช่วยให้ร้านและทีมงานพัฒนาบริการ
              การยกเลิกไม่สามารถย้อนกลับได้
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex flex-wrap gap-2">
            {cancelReasons.length === 0 && (
              <p className="text-sm text-neutral-400">กำลังโหลดเหตุผล…</p>
            )}
            {cancelReasons.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setCancelReasonId(r.id)}
                aria-pressed={cancelReasonId === r.id}
                className={`h-9 rounded-full border px-3 text-xs font-bold transition-colors ${
                  cancelReasonId === r.id
                    ? 'border-black bg-[#FFF4CC] text-black'
                    : 'border-line bg-white text-neutral-600 hover:border-neutral-300'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
          {actionError && (
            <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">
              {actionError}
            </p>
          )}
          <AlertDialogFooter className="flex-row gap-2">
            <AlertDialogCancel
              disabled={cancelling}
              className="mt-0 flex-1 rounded-full border-line"
            >
              ยกเลิก
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={cancelling || !cancelReasonId}
              data-testid="confirm-cancel-order"
              className="mt-0 flex-1 rounded-full bg-red-500 text-white hover:bg-red-600"
              onClick={() => void confirmCancel()}
            >
              {cancelling ? 'กำลังยกเลิก...' : 'ยืนยันยกเลิก'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
