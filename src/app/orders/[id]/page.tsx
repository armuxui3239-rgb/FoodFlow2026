'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, QrCode, Store, Zap } from 'lucide-react';
import { api, baht, STATUS_COLOR, STATUS_TH, useSession } from '@/lib/client';
import { CallButton } from '@/components/call-button';

interface Order {
  id: string;
  order_code: string;
  status: string;
  subtotal: number;
  delivery_fee: number;
  promotion_discount: number | null;
  total: number;
  notes: string | null;
  created_at: string;
  restaurants: { name: string } | null;
  order_items: { id: string; name_snapshot: string; quantity: number; unit_price: number }[];
}
interface Payment {
  id: string;
  status: string;
  amount: number;
}

const STEPS = ['pending_payment', 'paid', 'restaurant_accepted', 'preparing', 'ready_for_pickup', 'delivering', 'delivered'];

function thaiDateTime(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: 'numeric' })} – ${d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false })}`;
}

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useSession();
  const [order, setOrder] = useState<Order | null>(null);
  const [payment, setPayment] = useState<Payment | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [paying, setPaying] = useState(false);

  const load = useCallback(() => {
    api<{ order: Order; payment: Payment | null }>(`/api/orders/${id}`)
      .then((d) => {
        setOrder(d.order);
        setPayment(d.payment);
        if (d.order.status === 'pending_payment') {
          // QR ถูกสร้างตอนสั่งซื้อ — สร้างใหม่จากยอดเดิมเพื่อความชัวร์
          fetch(`/api/orders/${id}/qr`)
            .then((r) => r.json())
            .then((q) => setQr(q.qrImage))
            .catch(() => undefined);
        }
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(load, [load]);

  const confirmPaid = async () => {
    setPaying(true);
    try {
      await api(`/api/orders/${id}/pay`, { method: 'PATCH' });
      load();
    } finally {
      setPaying(false);
    }
  };

  if (loading) return <div className="h-64 animate-pulse rounded-3xl bg-neutral-100" />;
  if (error || !order) return <p className="py-16 text-center text-sm text-red-500">{error || 'ไม่พบคำสั่งซื้อ'}</p>;

  const stepIndex = STEPS.indexOf(order.status);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="truncate-1 text-xl font-bold text-black">คำสั่งซื้อ #{order.order_code}</h1>
        <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${STATUS_COLOR[order.status] ?? 'bg-neutral-100'}`}>
          {STATUS_TH[order.status] ?? order.status}
        </span>
      </div>
      <p className="truncate-1 text-sm text-neutral-500">ร้าน {order.restaurants?.name ?? 'อาหาร'}</p>

      {/* แถบสถานะ */}
      <section aria-label="สถานะคำสั่งซื้อ" className="rounded-3xl border border-line bg-white p-4">
        <ol className="flex items-center justify-between">
          {STEPS.slice(1).map((s, idx) => (
            <li key={s} className="flex flex-1 flex-col items-center gap-1 last:flex-none">
              <span
                className={`flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold ${
                  stepIndex >= idx + 1 ? 'bg-[#FFC400] text-black' : 'bg-neutral-100 text-neutral-400'
                }`}
              >
                {idx + 1}
              </span>
              <span className={`truncate-1 max-w-16 text-center text-[10px] ${stepIndex >= idx + 1 ? 'font-bold text-black' : 'text-neutral-400'}`}>
                {STATUS_TH[s]}
              </span>
            </li>
          ))}
        </ol>
      </section>

      {/* โทรเสียง/วิดีโอ — ปิดด้วย feature flag (v3.1 ข้อ 6) */}
      {stepIndex >= 1 && stepIndex < STEPS.length - 1 && (
        <section aria-label="การติดต่อผู้จัดส่ง" className="flex items-center justify-between rounded-3xl border border-line bg-white p-4">
          <div className="min-w-0">
            <p className="text-sm font-bold text-ink">ติดต่อผู้จัดส่ง</p>
            <p className="truncate-1 text-xs text-ink-soft">โทรเสียง/วิดีโอระหว่างจัดส่ง</p>
          </div>
          <CallButton orderId={order.id} />
        </section>
      )}

      {/* ============ สลิปชำระเงิน สไตล์ PromptPay ============ */}
      {order.status === 'pending_payment' && (
        <section
          aria-label="สลิปชำระเงิน PromptPay"
          className="overflow-hidden rounded-3xl border border-line bg-white shadow-md"
        >
          {/* หัวสลิป */}
          <div className="flex items-center justify-between gap-2 bg-gradient-to-r from-[#FFF4CC] via-white to-white px-5 pb-3 pt-4">
            <span className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#FFC400] text-black" aria-hidden>
                <Zap className="h-5 w-5" />
              </span>
              <span className="text-base font-bold text-black">ฟู๊ด ธันเดอร์</span>
            </span>
            <span className="text-[10px] font-medium text-neutral-400">PromptPay</span>
          </div>

          <div className="space-y-4 px-5 pb-5">
            {/* สถานะ + QR */}
            <div className="flex items-center gap-4">
              <div className="min-w-0 flex-1 space-y-1">
                <p className="flex items-center gap-2 text-lg font-bold text-black">
                  <QrCode className="h-5 w-5 shrink-0" aria-hidden /> สแกนเพื่อชำระเงิน
                </p>
                <p className="truncate-1 text-xs text-neutral-400">
                  รหัสสลิป {order.order_code}
                </p>
              </div>
              <div className="shrink-0 rounded-2xl bg-[#FFC400] p-2">
                {qr ? (
                   
                  <img src={qr} alt="คิวอาร์โค้ด PromptPay สำหรับชำระเงิน" className="h-28 w-28 rounded-xl bg-white" />
                ) : (
                  <div className="h-28 w-28 animate-pulse rounded-xl bg-white/60" />
                )}
              </div>
            </div>

            {/* จำนวนเงินใหญ่ */}
            <div className="rounded-2xl bg-neutral-50 px-4 py-3">
              <p className="text-xs text-neutral-400">จำนวนเงิน</p>
              <p className="text-3xl font-bold tabular-nums text-black">
                {(order.total / 100).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-base font-medium text-neutral-500">บาท</span>
              </p>
            </div>

            {/* จาก → โอนไป */}
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-base font-bold text-black" aria-hidden>
                  {(user?.fullName ?? 'ค').slice(0, 1)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-neutral-400">จาก</p>
                  <p className="truncate-1 font-bold text-black">{user?.fullName ?? 'ลูกค้าฟู๊ด ธันเดอร์'}</p>
                </div>
              </div>
              <div className="ml-[1.15rem] h-4 w-0.5 bg-neutral-200" aria-hidden />
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#FFC400] text-black" aria-hidden>
                  <Store className="h-5 w-5" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-neutral-400">โอนไป</p>
                  <p className="truncate-1 font-bold text-black">ร้าน {order.restaurants?.name ?? 'อาหาร'}</p>
                  <p className="truncate-1 text-xs text-neutral-400">PromptPay ของร้าน</p>
                </div>
              </div>
            </div>

            <button onClick={() => void confirmPaid()} disabled={paying} className="btn-brand h-12 w-full text-sm">
              {paying ? 'กำลังยืนยัน…' : 'แจ้งชำระเงินแล้ว'}
            </button>
            <p className="text-center text-[11px] text-neutral-400">
              ระบบจะตรวจสอบการชำระเงินของคุณ — ยืนยันด้วยตนเองชั่วคราว
            </p>
          </div>
        </section>
      )}

      {/* สลิปสำเร็จ — เหมือนรูปตัวอย่าง */}
      {order.status !== 'pending_payment' && (
        <section
          aria-label="สลิปโอนเงินสำเร็จ"
          className="overflow-hidden rounded-3xl border border-line bg-white shadow-md"
        >
          <div className="flex items-center justify-between gap-2 bg-gradient-to-r from-[#FFF4CC] via-white to-white px-5 pb-3 pt-4">
            <span className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#FFC400] text-black" aria-hidden>
                <Zap className="h-5 w-5" />
              </span>
              <span className="text-base font-bold text-black">ฟู๊ด ธันเดอร์</span>
            </span>
            <span className="text-[10px] font-medium text-neutral-400">PromptPay</span>
          </div>

          <div className="space-y-4 px-5 pb-5">
            <div className="flex items-center gap-4">
              <div className="min-w-0 flex-1 space-y-1">
                <p className="flex items-center gap-2 text-lg font-bold text-emerald-600">
                  <CheckCircle2 className="h-6 w-6 shrink-0" aria-hidden /> โอนเงินสำเร็จ
                </p>
                <p className="truncate-1 text-xs text-neutral-400">
                  รหัสสลิป {payment?.id ? payment.id.slice(0, 18).toUpperCase() : order.order_code}
                </p>
              </div>
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white" aria-hidden>
                <CheckCircle2 className="h-7 w-7" />
              </span>
            </div>

            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-base font-bold text-black" aria-hidden>
                  {(user?.fullName ?? 'ค').slice(0, 1)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-neutral-400">จาก</p>
                  <p className="truncate-1 font-bold text-black">{user?.fullName ?? 'ลูกค้าฟู๊ด ธันเดอร์'}</p>
                </div>
              </div>
              <div className="ml-[1.15rem] h-4 w-0.5 bg-neutral-200" aria-hidden />
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#FFC400] text-black" aria-hidden>
                  <Store className="h-5 w-5" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-neutral-400">โอนไป</p>
                  <p className="truncate-1 font-bold text-black">ร้าน {order.restaurants?.name ?? 'อาหาร'}</p>
                  <p className="truncate-1 text-xs text-neutral-400">PromptPay ของร้าน</p>
                </div>
              </div>
            </div>

            <dl className="space-y-2 border-t border-line pt-3 text-sm">
              <div className="flex justify-between gap-2">
                <dt className="text-neutral-500">จำนวนเงิน</dt>
                <dd className="shrink-0 text-xl font-bold tabular-nums text-black">
                  {(order.total / 100).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-sm font-medium text-neutral-500">บาท</span>
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-neutral-500">ค่าธรรมเนียม</dt>
                <dd className="shrink-0 tabular-nums text-neutral-500">0.00 บาท</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-neutral-500">วันที่ทำรายการ</dt>
                <dd className="shrink-0 tabular-nums text-neutral-500">{thaiDateTime(order.created_at)}</dd>
              </div>
            </dl>
          </div>
        </section>
      )}

      {/* รายการ + ยอดรวม */}
      <section aria-label="รายการอาหาร" className="space-y-2 rounded-3xl border border-line bg-white p-4">
        {order.order_items.map((i) => (
          <div key={i.id} className="flex justify-between gap-3 text-sm">
            <span className="truncate-1 text-neutral-600">{i.name_snapshot} × {i.quantity}</span>
            <span className="shrink-0 font-medium tabular-nums">{baht(i.unit_price * i.quantity)}</span>
          </div>
        ))}
        <div className="flex justify-between border-t border-line pt-2 text-sm text-neutral-500">
          <span>ค่าจัดส่ง</span>
          <span className="tabular-nums">{baht(order.delivery_fee)}</span>
        </div>
        {(order.promotion_discount ?? 0) > 0 && (
          <div className="flex justify-between text-sm font-medium text-emerald-600">
            <span>ส่วนลดคูปอง</span>
            <span className="tabular-nums">−{baht(order.promotion_discount)}</span>
          </div>
        )}
        <div className="flex justify-between text-base font-bold text-black">
          <span>รวมทั้งสิ้น</span>
          <span className="tabular-nums">{baht(order.total)}</span>
        </div>
        {order.notes && <p className="truncate-2 pt-1 text-xs text-neutral-400">โน้ต: {order.notes}</p>}
      </section>

      <div className="flex gap-2">
        <Link href="/orders" className="flex h-12 flex-1 items-center justify-center rounded-full border border-line text-sm text-neutral-600 hover:bg-neutral-50">
          ดูคำสั่งซื้อทั้งหมด
        </Link>
        <Link href="/" className="btn-brand flex h-12 flex-1 items-center justify-center text-sm">
          สั่งอาหารต่อ
        </Link>
      </div>
    </div>
  );
}
