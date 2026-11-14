'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { CheckCircle2, ChevronDown, HeartHandshake, MessageCircle, Phone, PhoneIncoming, PhoneOff, QrCode, SendHorizontal, Store, XCircle, Zap } from 'lucide-react';
import { api, baht, STATUS_COLOR, STATUS_TH, useSession } from '@/lib/client';
import { useOrderChat, type ChatMessage } from '@/lib/realtime';
import { sendRejectedToRoom, useIncomingRing } from '@/lib/calls';
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
  driver_id: string | null;
  restaurants: { name: string } | null;
  order_items: { id: string; name_snapshot: string; quantity: number; unit_price: number }[];
}
interface Payment {
  id: string;
  status: string;
  amount: number;
}

const STEPS = ['pending_payment', 'paid', 'restaurant_accepted', 'preparing', 'ready_for_pickup', 'delivering', 'delivered'];

// ทิปพร้อมเลือก: 20 / 50 / 100 บาท (สตางค์) — ช่วงที่ API รองรับคือ 2,000–100,000 สตางค์
const TIP_PRESETS = [2000, 5000, 10000];

// แชทใช้ได้เมื่อถึงช่วงที่มีไรเดอร์/กำลังจัดส่ง/ส่งถึงแล้ว — มีไรเดอร์คุยกับไรเดอร์ ยังไม่มีคุยกับร้าน
const CHAT_STATUSES = ['driver_assigned', 'driver_arriving_restaurant', 'picked_up', 'delivering', 'delivered', 'completed'];

// enum จริงของ chat_messages.sender_type: customer/driver/ai/system/restaurant/admin
const SENDER_TH: Record<string, string> = {
  customer: 'ลูกค้า',
  driver: 'ไรเดอร์',
  restaurant: 'ร้าน',
  ai: 'ผู้ช่วย AI',
  system: 'ระบบ',
  admin: 'แอดมิน',
};

function senderLabel(m: ChatMessage, myId: string | null | undefined): string {
  if (m.sender_id != null && m.sender_id === myId) return 'คุณ';
  return SENDER_TH[m.sender_type] ?? 'ผู้ส่ง';
}

function chatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function thaiDateTime(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: 'numeric' })} – ${d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false })}`;
}

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useSession();
  const [order, setOrder] = useState<Order | null>(null);
  const [payment, setPayment] = useState<Payment | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [paying, setPaying] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const [tipSatang, setTipSatang] = useState<number>(TIP_PRESETS[0]);
  const [tipCustom, setTipCustom] = useState<string>('');
  const [tipping, setTipping] = useState(false);
  const [tipDone, setTipDone] = useState(false);
  const [tipError, setTipError] = useState('');

  // แชทรายออเดอร์ — subscribe Supabase Broadcast เฉพาะเมื่อเปิดแท็บ (ล้มเหลว = polling สำรองทุก 8 วินาที)
  const [chatOpen, setChatOpen] = useState(false);
  const [chatDraft, setChatDraft] = useState('');
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const chatAvailable = !!order && CHAT_STATUSES.includes(order.status) && (!!order.driver_id || !!order.restaurants);
  const chat = useOrderChat(order?.id ?? null, chatOpen && chatAvailable, user?.id ?? null);

  // กริ่งสายเรียกเข้า (ระบบโทรจบในระบบ) — ลูกค้าฟังช่อง ring ส่วนตัวเฉพาะระหว่างเปิดหน้าออเดอร์
  // (ยอมรับข้อจำกัด: รับสายได้เมื่อกำลังเปิดหน้าออเดอร์บางหน้าอยู่เท่านั้น)
  const incomingCall = useIncomingRing(true);

  const acceptCall = () => {
    if (!incomingCall) return;
    router.push(`/calls/${encodeURIComponent(incomingCall.room)}?order=${encodeURIComponent(incomingCall.orderId)}`);
  };

  const rejectCall = () => {
    if (!incomingCall) return;
    void sendRejectedToRoom(incomingCall.room); // แจ้งห้องโทรให้ผู้ฝั่งโทรเห็นว่าถูกปฏิเสธ
  };

  useEffect(() => {
    const el = chatScrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [chat.messages, chatOpen]);

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

  /** ยกเลิกได้เฉพาะสถานะเดียวกับที่ API ยอมรับ (ก่อนร้านตอบรับออเดอร์) */
  const canCancel = ['created', 'pending_payment', 'restaurant_pending'].includes(order?.status ?? '');

  /** ทิปไรเดอร์ — ใช้จำนวนที่พิมพ์เองถ้ามี ไม่งั้นใช้พรีเซ็ต */
  const sendTip = async () => {
    if (!order) return;
    setTipError('');
    const amount = tipCustom.trim() === '' ? tipSatang : Math.round(Number(tipCustom) * 100);
    if (!Number.isFinite(amount) || amount < 2000 || amount > 100000) {
      setTipError('จำนวนทิปต้องอยู่ระหว่าง 20–1,000 บาท');
      return;
    }
    setTipping(true);
    try {
      await api('/api/driver/tips', { method: 'POST', body: JSON.stringify({ orderId: order.id, amountSatang: amount }) });
      setTipDone(true);
    } catch (e) {
      setTipError((e as Error).message); // 409 → "คุณทิปคำสั่งซื้อนี้ไปแล้ว"
    } finally {
      setTipping(false);
    }
  };

  const cancelOrder = async () => {
    if (!window.confirm('ยืนยันการยกเลิกคำสั่งซื้อนี้? การยกเลิกไม่สามารถย้อนคืนได้')) return;
    setCanceling(true);
    try {
      await api(`/api/orders/${id}/cancel`, { method: 'POST' });
      load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCanceling(false);
    }
  };

  // คู่สนทนา: session แบบ driver_customer = คุยกับไรเดอร์ ไม่เช่นนั้นคุยกับร้าน
  const chatPeer = chat.session?.type === 'driver_customer' ? 'ไรเดอร์' : 'ร้าน';

  const submitChat = async (e: FormEvent) => {
    e.preventDefault();
    const text = chatDraft.trim();
    if (!text || text.length > 1000) return;
    if (await chat.send(text)) setChatDraft('');
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

      {/* ยกเลิกคำสั่งซื้อ — เฉพาะก่อนร้านตอบรับ */}
      {canCancel && (
        <section aria-label="ยกเลิกคำสั่งซื้อ" className="flex items-center justify-between rounded-3xl border border-line bg-white p-4">
          <div className="min-w-0">
            <p className="text-sm font-bold text-ink">ยกเลิกคำสั่งซื้อ</p>
            <p className="truncate-1 text-xs text-ink-soft">ยกเลิกได้ก่อนร้านตอบรับออเดอร์เท่านั้น</p>
          </div>
          <button
            onClick={() => void cancelOrder()}
            disabled={canceling}
            data-testid="order-cancel"
            className="flex h-10 shrink-0 items-center gap-1.5 rounded-full border border-red-200 bg-white px-4 text-xs font-bold text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
          >
            <XCircle className="h-4 w-4" aria-hidden /> {canceling ? 'กำลังยกเลิก...' : 'ยกเลิก'}
          </button>
        </section>
      )}

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

      {/* แชทรายออเดอร์ — Supabase Broadcast ส่งแค่สัญญาณ เนื้อหาข้อความดึงใหม่จาก API เสมอ */}
      {chatAvailable && (
        <section aria-label="แชท" className="rounded-3xl border border-line bg-white">
          <button
            type="button"
            onClick={() => setChatOpen((v) => !v)}
            aria-expanded={chatOpen}
            data-testid="chat-toggle"
            className="flex w-full items-center justify-between gap-2 px-4 py-3.5"
          >
            <span className="flex items-center gap-2 text-sm font-bold text-black">
              <MessageCircle className="h-4.5 w-4.5 text-black" aria-hidden /> แชทกับ{chatPeer}
            </span>
            <ChevronDown className={`h-4 w-4 shrink-0 text-neutral-400 transition-transform ${chatOpen ? 'rotate-180' : ''}`} aria-hidden />
          </button>
          {chatOpen && (
            <div className="border-t border-line p-4">
              {chat.loading ? (
                <div className="h-40 animate-pulse rounded-2xl bg-neutral-100" />
              ) : chat.error ? (
                <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">{chat.error}</p>
              ) : (
                <>
                  <div ref={chatScrollRef} className="flex max-h-72 flex-col gap-2 overflow-y-auto pr-1">
                    {chat.messages.length === 0 && (
                      <p className="py-8 text-center text-xs text-neutral-400">ยังไม่มีข้อความ — เริ่มสนทนาได้เลย</p>
                    )}
                    {chat.messages.map((m) => {
                      const mine = chat.isMine(m);
                      return (
                        <div key={m.id} className={`max-w-[85%] ${mine ? 'self-end' : 'self-start'}`}>
                          <p className={`mb-0.5 text-[10px] text-neutral-400 ${mine ? 'text-right' : ''}`}>
                            {senderLabel(m, user?.id)} · {chatTime(m.created_at)}
                          </p>
                          <div className={`whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-sm ${mine ? 'bg-black text-white' : 'bg-neutral-100 text-black'}`}>
                            {m.content}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <form onSubmit={(e) => void submitChat(e)} className="mt-3 flex items-center gap-2">
                    <input
                      value={chatDraft}
                      onChange={(e) => setChatDraft(e.target.value)}
                      maxLength={1000}
                      placeholder="พิมพ์ข้อความ…"
                      aria-label="ข้อความแชท"
                      data-testid="chat-input"
                      className="h-11 min-w-0 flex-1 rounded-full border border-line px-4 text-sm text-black outline-none placeholder:text-neutral-400 focus:border-[#FFC400]"
                    />
                    <button
                      type="submit"
                      disabled={chat.sending || chatDraft.trim() === ''}
                      aria-label="ส่งข้อความ"
                      data-testid="chat-send"
                      className="btn-brand flex h-11 w-11 shrink-0 items-center justify-center rounded-full disabled:opacity-50"
                    >
                      <SendHorizontal className="h-4.5 w-4.5" aria-hidden />
                    </button>
                  </form>
                </>
              )}
            </div>
          )}
        </section>
      )}

      {/* ทิปไรเดอร์ — หลังส่งถึงแล้ว และมีไรเดอร์ผู้รับงาน (ทิปได้ครั้งเดียวต่อออเดอร์) */}
      {['delivered', 'completed'].includes(order.status) && order.driver_id && (
        <section aria-label="ทิปไรเดอร์" className="rounded-3xl border border-line bg-white p-4">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#FFF4CC]" aria-hidden>
              <HeartHandshake className="h-4.5 w-4.5 text-black" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-ink">ทิปไรเดอร์</p>
              <p className="truncate-1 text-xs text-ink-soft">ขอบคุณไรเดอร์ที่ส่งอาหารถึงมือคุณ (ทิปได้ครั้งเดียวต่อออเดอร์)</p>
            </div>
          </div>
          {tipDone ? (
            <p className="mt-3 flex items-center gap-2 rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-600">
              <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden /> ขอบคุณสำหรับทิป
            </p>
          ) : (
            <>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {TIP_PRESETS.map((s) => (
                  <button
                    key={s}
                    onClick={() => {
                      setTipSatang(s);
                      setTipCustom('');
                      setTipError('');
                    }}
                    className={`h-11 rounded-full border text-sm font-bold transition-colors ${
                      tipCustom.trim() === '' && tipSatang === s
                        ? 'border-[#FFC400] bg-[#FFF4CC] text-black'
                        : 'border-line text-neutral-600 hover:bg-neutral-50'
                    }`}
                  >
                    {baht(s)}
                  </button>
                ))}
              </div>
              <div className="mt-2 flex items-center gap-2">
                <input
                  inputMode="decimal"
                  value={tipCustom}
                  onChange={(e) => {
                    setTipCustom(e.target.value.replace(/[^0-9.]/g, ''));
                    setTipError('');
                  }}
                  placeholder="จำนวนเอง (บาท)"
                  aria-label="จำนวนทิปแบบกำหนดเอง"
                  className="h-11 min-w-0 flex-1 rounded-full border border-line px-4 text-sm text-black outline-none placeholder:text-neutral-400 focus:border-[#FFC400]"
                />
                <button
                  onClick={() => void sendTip()}
                  disabled={tipping}
                  data-testid="tip-send"
                  className="btn-brand flex h-11 shrink-0 items-center gap-1.5 rounded-full px-5 text-sm"
                >
                  <HeartHandshake className="h-4 w-4" aria-hidden /> {tipping ? 'กำลังส่ง...' : 'ส่งทิป'}
                </button>
              </div>
              {tipError && (
                <p role="alert" className="mt-2 rounded-2xl bg-red-50 px-4 py-2.5 text-xs text-red-600">
                  {tipError}
                </p>
              )}
            </>
          )}
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
            <span className="tabular-nums">−{baht(order.promotion_discount ?? 0)}</span>
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

      {/* สายเรียกเข้า — โมดัลกริ่งจากช่อง ring ส่วนตัว (auto หายไปเองใน 60 วิ) */}
      {incomingCall && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="สายเรียกเข้า"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
        >
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 text-center shadow-xl">
            <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#FFF4CC]" aria-hidden>
              <PhoneIncoming className="h-8 w-8 animate-bounce text-black" />
            </span>
            <p className="mt-3 text-base font-bold text-black">สายเรียกเข้า</p>
            <p className="mt-1 text-sm text-ink-soft">
              สายเรียกเข้าจาก {incomingCall.fromName} เรื่องออเดอร์ #{incomingCall.orderCode}
            </p>
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={rejectCall}
                aria-label="ปฏิเสธสาย"
                className="flex h-12 flex-1 items-center justify-center gap-1.5 rounded-full border border-red-200 bg-white text-sm font-bold text-red-600 transition-colors hover:bg-red-50"
              >
                <PhoneOff className="h-4 w-4" aria-hidden /> ปฏิเสธ
              </button>
              <button
                type="button"
                onClick={acceptCall}
                aria-label="รับสาย"
                className="flex h-12 flex-1 items-center justify-center gap-1.5 rounded-full bg-brand text-sm font-bold text-black transition hover:bg-brand-strong"
              >
                <Phone className="h-4 w-4" aria-hidden /> รับสาย
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
