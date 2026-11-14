'use client';

import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { useParams } from 'next/navigation';
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
import { ArrowLeft, CheckCircle2, ChevronDown, ClipboardList, HandCoins, MapPin, MessageCircle, Navigation, PackageCheck, SendHorizontal, Star } from 'lucide-react';
import { api, baht, STATUS_TH, useSession } from '@/lib/client';
import { useOrderChat, type ChatMessage } from '@/lib/realtime';
import type { MapPoint } from '@/app/orders/[id]/map/MapCanvas';

// สถานะงานส่ง (DeliveryTaskStatus จริงในฐานข้อมูล: assigned/picked_up/delivered) — แยกจาก STATUS_TH ของออเดอร์
const TASK_TH: Record<string, string> = {
  assigned: 'ได้รับงานแล้ว',
  picked_up: 'รับของแล้ว',
  delivered: 'ส่งสำเร็จ',
};

// โหลด maplibre เฉพาะเบราว์เซอร์ — กัน SSR compile กินหน่วยความจำจนเซิร์ฟเวอร์ OOM
const MapCanvas = dynamic(() => import('@/app/orders/[id]/map/MapCanvas'), {
  ssr: false,
  loading: () => <div className="flex h-full items-center justify-center text-sm text-neutral-400">กำลังโหลดแผนที่…</div>,
});

interface TripDetail {
  task: {
    id: string;
    status: string;
    assignedAt: string | null;
    pickedUpAt: string | null;
    deliveredAt: string | null;
    distanceKm: number | null;
  };
  order: {
    id: string;
    code: string;
    status: string;
    deliveryFeeSatang: number;
    subtotalSatang: number;
    dropoffLabel: string | null;
    dropoffAddress: string | null;
    createdAt: string;
  };
  restaurant: { name: string; address: string | null };
  customerName: string;
  items: { name: string; quantity: number; unitPriceSatang: number }[];
  history: { id: string; status: string; created_at: string }[];
}

interface TripMapData {
  restaurant: { name: string; coords: [number, number] | null };
  dropoff: { coords: [number, number] | null };
  driver: { name: string; lat: number | null; lng: number | null } | null;
}

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

/** หน้ารายละเอียดงานส่ง — ข้อมูลจริงจาก /api/driver/trips/[id] */
export default function DriverTripPage() {
  const params = useParams<{ id: string }>();
  const tripId = params?.id ?? '';
  const [data, setData] = useState<TripDetail | null>(null);
  const [mapData, setMapData] = useState<TripMapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // รายงานทิป — dialog state
  const [tipOpen, setTipOpen] = useState(false);
  const [tipPreset, setTipPreset] = useState<number | null>(null);
  const [tipCustom, setTipCustom] = useState('');
  const [tipBusy, setTipBusy] = useState(false);
  const [tipErr, setTipErr] = useState('');
  const [tipDone, setTipDone] = useState(false);
  const [tipReported, setTipReported] = useState(false);

  // แชทกับลูกค้า — subscribe Supabase Broadcast เฉพาะเมื่อเปิดแท็บ (ล้มเหลว = polling สำรองทุก 8 วินาที)
  const { user } = useSession();
  const [chatOpen, setChatOpen] = useState(false);
  const [chatDraft, setChatDraft] = useState('');
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const chat = useOrderChat(data?.order.id ?? null, chatOpen && !!data, user?.id ?? null);

  useEffect(() => {
    const el = chatScrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [chat.messages, chatOpen]);

  const load = useCallback(() => {
    if (tripId === '') return;
    api<TripDetail>(`/api/driver/trips/${encodeURIComponent(tripId)}`)
      .then((d) => {
        setData(d);
        setError('');
        // พิกัดร้าน/จุดส่ง/ไรเดอร์ — เอนด์พอยต์เดียวกับหน้าแผนที่ลูกค้า (ไรเดอร์ผู้รับงานเข้าถึงได้)
        api<TripMapData>(`/api/orders/${encodeURIComponent(d.order.id)}/map`)
          .then((m) => setMapData(m))
          .catch(() => setMapData(null)); // แผนที่ล้มเหลว — ข้อมูลงานยังใช้ได้ปกติ
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [tripId]);

  useEffect(load, [load]);

  const fmt = (iso: string | null) =>
    iso
      ? new Date(iso).toLocaleString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
      : '-';

  // รายงานทิป — เปิด dialog (รีเซ็ตสถานะในฟอร์ม)
  const openTipDialog = () => {
    setTipPreset(null);
    setTipCustom('');
    setTipErr('');
    setTipDone(false);
    setTipOpen(true);
  };

  const reportTip = async () => {
    setTipErr('');
    if (tipPreset === null && tipCustom.trim() === '') {
      setTipErr('กรุณาเลือกหรือระบุจำนวนทิป');
      return;
    }
    const satang = tipPreset ?? Math.round(Number(tipCustom) * 100);
    if (!Number.isInteger(satang) || satang < 2000 || satang > 100000) {
      setTipErr('จำนวนทิปต้องอยู่ระหว่าง 20–1,000 บาท');
      return;
    }
    setTipBusy(true);
    try {
      await api(`/api/driver/trips/${encodeURIComponent(tripId)}/tip-report`, {
        method: 'POST',
        body: JSON.stringify({ amountSatang: satang }),
      });
      setTipDone(true);
      setTipReported(true);
    } catch (e) {
      setTipErr((e as Error).message); // 409 → "รายงานทิปนี้แล้ว"
    } finally {
      setTipBusy(false);
    }
  };

  const submitChat = async (e: FormEvent) => {
    e.preventDefault();
    const text = chatDraft.trim();
    if (!text || text.length > 1000) return;
    if (await chat.send(text)) setChatDraft('');
  };

  // จุดบนแผนที่: ร้าน → จุดส่ง → ตำแหน่งล่าสุดของไรเดอร์ (จาก driver_profiles ที่ส่งพิกัดอัตโนมัติ)
  const points: MapPoint[] = [];
  if (mapData?.restaurant.coords) points.push({ lng: mapData.restaurant.coords[0], lat: mapData.restaurant.coords[1], label: 'restaurant' });
  if (mapData?.dropoff.coords) points.push({ lng: mapData.dropoff.coords[0], lat: mapData.dropoff.coords[1], label: 'dropoff' });
  if (mapData?.driver?.lat && mapData?.driver?.lng) points.push({ lng: mapData.driver.lng, lat: mapData.driver.lat, label: 'driver' });

  // รายงานทิปได้เมื่องานส่งสำเร็จ และออเดอร์ถึงสถานะ delivered/completed
  const canTip = data !== null && data.task.status === 'delivered' && (data.order.status === 'delivered' || data.order.status === 'completed');

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <header className="sticky top-0 z-40 border-b border-line bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-2 px-4">
          <Link
            href="/driver/history"
            aria-label="ย้อนกลับไปประวัติงาน"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-neutral-100 transition-transform active:scale-95"
          >
            <ArrowLeft className="h-5 w-5" aria-hidden />
          </Link>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#FFC400] text-black">
            <ClipboardList className="h-5 w-5" aria-hidden />
          </span>
          <h1 className="truncate-1 text-sm font-bold text-black">
            งานส่ง #{data?.order.code ?? params?.id?.slice(0, 8) ?? '...'}
          </h1>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 space-y-4 px-4 py-5">
        {error && <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}

        {loading ? (
          <div className="space-y-3">
            <div className="h-24 animate-pulse rounded-3xl bg-neutral-100" />
            <div className="h-40 animate-pulse rounded-3xl bg-neutral-100" />
          </div>
        ) : data ? (
          <>
            {/* สรุปงาน */}
            <section aria-label="สรุปงาน" className="rounded-3xl bg-black p-5 text-white">
              <div className="flex items-center justify-between gap-2">
                <span className="text-lg font-bold text-[#FFC400]">#{data.order.code}</span>
                <span className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-bold text-[#FFC400]">
                  {TASK_TH[data.task.status] ?? data.task.status}
                </span>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                <div>
                  <p className="font-bold text-white">{data.task.distanceKm ? `${Number(data.task.distanceKm).toFixed(1)} กม.` : '-'}</p>
                  <p className="text-white/50">ระยะทาง</p>
                </div>
                <div>
                  <p className="font-bold text-white">{fmt(data.task.pickedUpAt)}</p>
                  <p className="text-white/50">รับของ</p>
                </div>
                <div>
                  <p className="font-bold text-white">{fmt(data.task.deliveredAt)}</p>
                  <p className="text-white/50">ส่งถึง</p>
                </div>
              </div>
            </section>

            {/* เส้นทาง */}
            <section aria-label="เส้นทาง" className="space-y-2 rounded-3xl border border-line bg-white p-4">
              <p className="flex items-start gap-2 text-sm text-neutral-700">
                <Navigation className="mt-0.5 h-4.5 w-4.5 shrink-0 text-black" aria-hidden />
                <span>
                  <b>รับที่ร้าน:</b> {data.restaurant.name}
                  {data.restaurant.address && <span className="block text-xs text-neutral-400">{data.restaurant.address}</span>}
                </span>
              </p>
              <p className="flex items-start gap-2 text-sm text-neutral-700">
                <MapPin className="mt-0.5 h-4.5 w-4.5 shrink-0 text-black" aria-hidden />
                <span>
                  <b>ส่งให้ {data.customerName}:</b>{' '}
                  {data.order.dropoffLabel ? `${data.order.dropoffLabel} · ` : ''}
                  {data.order.dropoffAddress ?? 'ไม่มีที่อยู่'}
                </span>
              </p>
            </section>

            {/* แผนที่เส้นทาง: ร้าน / จุดส่ง / ไรเดอร์ */}
            <section aria-label="แผนที่เส้นทาง" className="overflow-hidden rounded-3xl border border-line bg-white">
              <h2 className="border-b border-line px-4 py-3 text-xs font-bold uppercase tracking-wide text-neutral-400">
                แผนที่เส้นทาง
              </h2>
              <div className="h-72">
                {points.length > 0 ? (
                  <MapCanvas points={points} />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-neutral-400">
                    ยังไม่มีพิกัดสำหรับงานนี้
                  </div>
                )}
              </div>
              {points.length > 0 && (
                <p className="border-t border-line px-4 py-2.5 text-[11px] text-neutral-400">
                  หมุดดำ = ร้าน · หมุดเหลือง = จุดส่ง · หมุดเทา = ตำแหน่งล่าสุดของคุณ
                </p>
              )}
            </section>

            {/* รายการอาหาร */}
            <section aria-label="รายการอาหาร" className="rounded-3xl border border-line bg-white">
              <h2 className="border-b border-line px-4 py-3 text-xs font-bold uppercase tracking-wide text-neutral-400">
                รายการอาหาร
              </h2>
              <ul>
                {data.items.map((it, i) => (
                  <li key={i} className={`flex items-center justify-between px-4 py-3 text-sm ${i > 0 ? 'border-t border-line' : ''}`}>
                    <span className="min-w-0 flex-1 truncate-1 text-black">
                      {it.quantity}× {it.name}
                    </span>
                    <span className="shrink-0 text-neutral-500">{baht(it.unitPriceSatang * it.quantity)}</span>
                  </li>
                ))}
              </ul>
              <div className="flex items-center justify-between border-t border-line px-4 py-3 text-sm">
                <span className="text-neutral-500">ค่าส่งของฉัน</span>
                <span className="font-bold text-black">+{baht(data.order.deliveryFeeSatang)}</span>
              </div>
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

            {/* รายงานทิป — เฉพาะงานที่ส่งสำเร็จและออเดอร์ถึงลูกค้าแล้ว */}
            {canTip && (
              <section aria-label="รายงานทิป" className="rounded-3xl border border-line bg-white p-4">
                <p className="flex items-center gap-2 text-sm font-bold text-black">
                  <HandCoins className="h-4.5 w-4.5 text-black" aria-hidden /> ได้รับทิปจากลูกค้าหรือไม่?
                </p>
                <p className="mt-1 text-xs leading-relaxed text-neutral-500">
                  บันทึกทิปของออเดอร์นี้เพื่อรวมในรายได้ทิปของคุณ (ทิปได้ครั้งเดียวต่อออเดอร์)
                </p>
                {tipReported ? (
                  <p className="mt-3 flex items-center gap-1.5 rounded-2xl bg-neutral-50 px-3 py-2.5 text-xs font-bold text-black">
                    <CheckCircle2 className="h-4 w-4 text-black" aria-hidden /> บันทึกทิปแล้ว
                  </p>
                ) : (
                  <button
                    type="button"
                    onClick={openTipDialog}
                    data-testid="tip-open"
                    className="btn-brand mt-3 flex h-11 w-full items-center justify-center gap-2 text-sm"
                  >
                    <HandCoins className="h-4.5 w-4.5" aria-hidden /> รายงานทิปที่ได้รับ
                  </button>
                )}
              </section>
            )}

            {/* ประวัติสถานะ */}
            <section aria-label="ประวัติสถานะ" className="rounded-3xl border border-line bg-white">
              <h2 className="border-b border-line px-4 py-3 text-xs font-bold uppercase tracking-wide text-neutral-400">
                เส้นทางสถานะ
              </h2>
              <ul>
                {data.history.map((h, i) => (
                  <li key={h.id} className={`flex items-center gap-3 px-4 py-2.5 text-xs ${i > 0 ? 'border-t border-line' : ''}`}>
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-neutral-300" aria-hidden />
                    <span className="min-w-0 flex-1 truncate-1 font-medium text-neutral-700">{STATUS_TH[h.status] ?? h.status}</span>
                    <span className="shrink-0 text-neutral-400">{fmt(h.created_at)}</span>
                  </li>
                ))}
                {data.history.length === 0 && (
                  <li className="px-4 py-3 text-xs text-neutral-400">ยังไม่มีประวัติสถานะ</li>
                )}
              </ul>
            </section>

            {/* Dialog รายงานทิป — ปุ่มลัด ฿20/50/100 หรือระบุจำนวนเอง */}
            <AlertDialog open={tipOpen} onOpenChange={(open) => !open && setTipOpen(false)}>
              <AlertDialogContent className="rounded-3xl">
                <AlertDialogHeader>
                  <AlertDialogTitle>รายงานทิปที่ได้รับ</AlertDialogTitle>
                  <AlertDialogDescription>
                    ระบุจำนวนทิปที่ลูกค้าให้สำหรับออเดอร์ #{data.order.code} (20–1,000 บาท)
                  </AlertDialogDescription>
                </AlertDialogHeader>
                {tipDone ? (
                  <p className="flex items-center gap-2 rounded-2xl bg-neutral-50 px-3 py-3 text-sm font-bold text-black" data-testid="tip-success">
                    <CheckCircle2 className="h-5 w-5 text-black" aria-hidden /> บันทึกทิปแล้ว
                  </p>
                ) : (
                  <div className="space-y-3">
                    <div className="flex gap-2">
                      {[2000, 5000, 10000].map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => {
                            setTipPreset(s);
                            setTipErr('');
                          }}
                          data-testid={`tip-preset-${s / 100}`}
                          className={`h-10 flex-1 rounded-full border text-sm font-bold transition ${
                            tipPreset === s ? 'border-black bg-black text-[#FFC400]' : 'border-line bg-white text-black hover:bg-neutral-50'
                          }`}
                        >
                          {baht(s)}
                        </button>
                      ))}
                    </div>
                    <label className="block space-y-1">
                      <span className="text-xs font-bold text-black">จำนวนอื่น (บาท)</span>
                      <input
                        value={tipCustom}
                        onChange={(e) => {
                          setTipCustom(e.target.value);
                          setTipPreset(null);
                        }}
                        type="number"
                        min={20}
                        max={1000}
                        inputMode="decimal"
                        data-testid="tip-custom"
                        placeholder="เช่น 75"
                        className="h-12 w-full rounded-2xl border border-line bg-white px-3 text-sm text-black placeholder:text-neutral-300"
                      />
                    </label>
                    {tipErr && <p role="alert" className="text-xs font-bold text-red-600">{tipErr}</p>}
                  </div>
                )}
                <AlertDialogFooter className="flex-row gap-2">
                  <AlertDialogCancel className="mt-0 flex-1 rounded-full border-line" disabled={tipBusy}>
                    ยกเลิก
                  </AlertDialogCancel>
                  <AlertDialogAction
                    className="flex-1 rounded-full bg-black text-[#FFC400] hover:bg-neutral-800"
                    disabled={tipBusy}
                    data-testid="tip-submit"
                    onClick={(e) => {
                      if (tipDone) return; // ปิด dialog ตามปกติ
                      e.preventDefault(); // กันปิดก่อนตรวจ/บันทึกเสร็จ
                      void reportTip();
                    }}
                  >
                    {tipDone ? 'เสร็จสิ้น' : tipBusy ? 'กำลังบันทึก...' : 'บันทึกทิป'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <Link
              href="/driver/history"
              className="btn-brand flex h-12 w-full items-center justify-center gap-2 text-sm"
            >
              <PackageCheck className="h-4.5 w-4.5" aria-hidden /> กลับไปประวัติงานส่ง
            </Link>
          </>
        ) : (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <Star className="h-10 w-10 text-neutral-300" aria-hidden />
            <p className="text-sm text-neutral-400">ไม่พบงานส่งนี้</p>
          </div>
        )}
      </main>

      <footer className="mt-auto border-t border-line bg-white pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-4 text-center text-xs text-neutral-400">
        © {new Date().getFullYear()} ฟู๊ด ธันเดอร์ — พอร์ทัลไรเดอร์
      </footer>
    </div>
  );
}
