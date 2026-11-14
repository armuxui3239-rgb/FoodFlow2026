'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowLeft, ChevronDown, Clock, MapPin, MessageCircle, Phone, RefreshCw, Receipt, SendHorizontal, User, Wallet } from 'lucide-react';
import { api, baht, STATUS_TH, STATUS_COLOR, useSession } from '@/lib/client';
import { useOrderChat, type ChatMessage } from '@/lib/realtime';

interface OrderFull {
  id: string;
  order_code: string;
  status: string;
  payment_method: string;
  subtotal: number;
  delivery_fee: number;
  promotion_discount: number;
  total: number;
  notes: string | null;
  created_at: string;
}

interface ItemRow {
  name_snapshot: string;
  quantity: number;
  unit_price: number;
  notes: string | null;
}

interface HistoryRow {
  status: string;
  note: string | null;
  created_at: string;
}

interface CustomerInfo {
  full_name: string;
  phone: string | null;
}

const PAYMENT_TH: Record<string, string> = {
  cash: 'เงินสดปลายทาง',
  promptpay: 'พร้อมเพย์',
  mock_wallet: 'กระเป๋าเงิน (ทดสอบ)',
};

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

/** ปุ่มถัดไปตามลำดับสถานะของร้าน (OWNER_TRANSITIONS) */
const NEXT_ACTION: Record<string, { action: string; label: string }> = {
  paid: { action: 'accept', label: 'รับออเดอร์' },
  restaurant_accepted: { action: 'prepare', label: 'เริ่มทำอาหาร' },
  preparing: { action: 'ready', label: 'พร้อมส่งแล้ว' },
};

/** หน้ารายละเอียดออเดอร์ของร้าน — สถานะ รายการอาหาร ยอดรวม และไทม์ไลน์ */
export default function OwnerOrderDetailPage() {
  const { user, ready } = useSession();
  const params = useParams<{ id: string }>();
  const id = params?.id;

  const [order, setOrder] = useState<OrderFull | null>(null);
  const [items, setItems] = useState<ItemRow[]>([]);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [customer, setCustomer] = useState<CustomerInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [tick, setTick] = useState(0);

  // แชทกับลูกค้า — subscribe Supabase Broadcast เฉพาะเมื่อเปิดแท็บ (ล้มเหลว = polling สำรองทุก 8 วินาที)
  const [chatOpen, setChatOpen] = useState(false);
  const [chatDraft, setChatDraft] = useState('');
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const chat = useOrderChat(order?.id ?? null, chatOpen && !!order, user?.id ?? null);

  useEffect(() => {
    const el = chatScrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [chat.messages, chatOpen]);

  const load = useCallback(() => {
    if (!id) return;
    setError('');
    // รายละเอียดเต็มของออเดอร์ + ชื่อ/เบอร์โทรลูกค้าจากรายการออเดอร์ของร้าน
    Promise.all([
      api<{ order: OrderFull; items: ItemRow[]; history: HistoryRow[] }>(`/api/owner/orders/${id}`),
      api<{ data: (OrderFull & { customer: CustomerInfo | null })[] }>('/api/owner/orders'),
    ])
      .then(([detail, list]) => {
        setOrder(detail.order);
        setItems(detail.items ?? []);
        setHistory(detail.history ?? []);
        setCustomer(list.data.find((o) => o.id === id)?.customer ?? null);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(load, [load, tick]);

  const act = async (action: string) => {
    if (!id) return;
    setBusy(true);
    setError('');
    try {
      await api(`/api/owner/orders/${id}`, { method: 'PATCH', body: JSON.stringify({ action }) });
      setTick((x) => x + 1);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const submitChat = async (e: FormEvent) => {
    e.preventDefault();
    const text = chatDraft.trim();
    if (!text || text.length > 1000) return;
    if (await chat.send(text)) setChatDraft('');
  };

  const denied = ready && (!user || user.role !== 'restaurant');
  const next = order ? NEXT_ACTION[order.status] : undefined;

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <header className="sticky top-0 z-40 border-b border-line bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-3xl items-center gap-2 px-4">
          <Link
            href="/owner/orders"
            aria-label="ย้อนกลับ"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-neutral-100 transition-transform active:scale-95"
          >
            <ArrowLeft className="h-5 w-5" aria-hidden />
          </Link>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#FFC400] text-black">
            <Receipt className="h-5 w-5" aria-hidden />
          </span>
          <h1 className="min-w-0 truncate-1 text-sm font-bold text-black">
            ออเดอร์ {order ? `#${order.order_code}` : ''}
          </h1>
          {order && (
            <span className={`ml-auto shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${STATUS_COLOR[order.status] ?? 'bg-neutral-100 text-neutral-700'}`}>
              {STATUS_TH[order.status] ?? order.status}
            </span>
          )}
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 space-y-4 px-4 py-5">
        {denied && (
          <p role="alert" className="rounded-2xl bg-[#FFF4CC] px-4 py-3 text-sm font-semibold text-black">
            หน้านี้สำหรับเจ้าของร้านเท่านั้น กรุณาเข้าสู่ระบบด้วยบัญชีร้านค้า
          </p>
        )}
        {error && (
          <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </p>
        )}

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-28 animate-pulse rounded-3xl bg-neutral-100" />
            ))}
          </div>
        ) : order && (
          <>
            {/* สรุปออเดอร์ */}
            <section className="rounded-3xl border border-line p-4" aria-label="สรุปออเดอร์">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-lg font-bold text-black">#{order.order_code}</p>
                <span className="flex items-center gap-1 text-xs text-neutral-400">
                  <Clock className="h-3.5 w-3.5" aria-hidden />
                  {new Date(order.created_at).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })}
                </span>
              </div>
              <p className="mt-1 text-xs text-neutral-500">
                ชำระเงิน: {PAYMENT_TH[order.payment_method] ?? order.payment_method}
              </p>
            </section>

            {/* ข้อมูลลูกค้า */}
            <section className="rounded-3xl border border-line p-4" aria-label="ข้อมูลลูกค้า">
              <h2 className="mb-2 flex items-center gap-2 text-sm font-bold text-black">
                <User className="h-4 w-4" aria-hidden /> ข้อมูลลูกค้า
              </h2>
              <p className="text-sm text-black">{customer?.full_name ?? 'ลูกค้า'}</p>
              {customer?.phone && (
                <p className="mt-0.5 flex items-center gap-1 text-sm text-neutral-600">
                  <Phone className="h-3.5 w-3.5" aria-hidden /> {customer.phone}
                </p>
              )}
              <p className="mt-1 flex items-center gap-1 text-xs text-neutral-400">
                <MapPin className="h-3.5 w-3.5" aria-hidden /> ที่อยู่จัดส่งแสดงในงานของไรเดอร์ (ข้อมูลอยู่ในตาราง addresses ฝั่งเซิร์ฟเวอร์)
              </p>
            </section>

            {/* แชทกับลูกค้า — Supabase Broadcast ส่งแค่สัญญาณ เนื้อหาข้อความดึงใหม่จาก API เสมอ */}
            <section aria-label="แชท" className="rounded-3xl border border-line bg-white">
              <button
                type="button"
                onClick={() => setChatOpen((v) => !v)}
                aria-expanded={chatOpen}
                data-testid="chat-toggle"
                className="flex w-full items-center justify-between gap-2 px-4 py-3.5"
              >
                <span className="flex items-center gap-2 text-sm font-bold text-black">
                  <MessageCircle className="h-4.5 w-4.5 text-black" aria-hidden /> แชทกับลูกค้า
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

            {/* รายการอาหาร */}
            <section className="rounded-3xl border border-line p-4" aria-label="รายการอาหาร">
              <h2 className="mb-2 text-sm font-bold text-black">รายการอาหาร</h2>
              <ul className="space-y-1.5">
                {items.map((i, idx) => (
                  <li key={idx} className="flex items-start justify-between gap-2 text-sm">
                    <span className="min-w-0 flex-1 text-black">
                      <span className="font-semibold">{i.name_snapshot}</span> × {i.quantity}
                      {i.notes && <span className="block text-xs text-neutral-500">หมายเหตุ: {i.notes}</span>}
                    </span>
                    <span className="shrink-0 font-bold text-black">{baht(i.unit_price * i.quantity)}</span>
                  </li>
                ))}
                {items.length === 0 && <li className="py-2 text-center text-sm text-neutral-300">ไม่มีรายการอาหาร</li>}
              </ul>

              <div className="mt-3 space-y-1 border-t border-line pt-3 text-sm">
                <p className="flex justify-between text-neutral-600">
                  <span>ยอดอาหาร</span>
                  <span>{baht(order.subtotal)}</span>
                </p>
                <p className="flex justify-between text-neutral-600">
                  <span>ค่าจัดส่ง</span>
                  <span>{baht(order.delivery_fee)}</span>
                </p>
                {order.promotion_discount > 0 && (
                  <p className="flex justify-between text-neutral-600">
                    <span>ส่วนลดคูปอง</span>
                    <span>-{baht(order.promotion_discount)}</span>
                  </p>
                )}
                <p className="flex justify-between text-base font-bold text-black">
                  <span>ยอดรวม</span>
                  <span>{baht(order.total)}</span>
                </p>
              </div>
            </section>

            {/* หมายเหตุจากลูกค้า */}
            {order.notes && (
              <section className="rounded-3xl bg-[#FFF4CC] p-4" aria-label="หมายเหตุ">
                <h2 className="text-sm font-bold text-black">หมายเหตุจากลูกค้า</h2>
                <p className="mt-1 text-sm text-neutral-700">{order.notes}</p>
              </section>
            )}

            {/* ไทม์ไลน์สถานะ */}
            <section className="rounded-3xl border border-line p-4" aria-label="ไทม์ไลน์สถานะ">
              <h2 className="mb-3 text-sm font-bold text-black">ไทม์ไลน์สถานะ</h2>
              {history.length === 0 ? (
                <p className="py-2 text-center text-sm text-neutral-300">ยังไม่มีประวัติการเปลี่ยนสถานะ</p>
              ) : (
                <ol className="relative space-y-3 border-l-2 border-line pl-4">
                  {history.map((h, idx) => (
                    <li key={idx} className="relative">
                      <span className="absolute -left-[22px] top-1 h-3 w-3 rounded-full bg-[#FFC400] ring-2 ring-white" aria-hidden />
                      <p className="text-sm font-bold text-black">{STATUS_TH[h.status] ?? h.status}</p>
                      <p className="text-xs text-neutral-400">
                        {new Date(h.created_at).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })}
                        {h.note ? ` · ${h.note}` : ''}
                      </p>
                    </li>
                  ))}
                </ol>
              )}
            </section>

            {/* ปุ่มดำเนินการถัดไป */}
            {next && (
              <button
                onClick={() => void act(next.action)}
                disabled={busy}
                className="btn-brand flex h-12 w-full items-center justify-center gap-2 text-sm disabled:opacity-50"
              >
                {busy ? <RefreshCw className="h-4 w-4 animate-spin" aria-hidden /> : <Wallet className="h-4 w-4" aria-hidden />}
                {next.label}
              </button>
            )}
          </>
        )}
      </main>

      <footer className="mt-auto border-t border-line bg-white pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-4 text-center text-xs text-neutral-400">
        © {new Date().getFullYear()} ฟู๊ด ธันเดอร์ — พอร์ทัลร้านค้า
      </footer>
    </div>
  );
}
