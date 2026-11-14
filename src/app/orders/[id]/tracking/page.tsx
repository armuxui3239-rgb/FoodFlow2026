'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  Bike,
  CheckCircle2,
  ChevronLeft,
  Circle,
  LoaderCircle,
  MapPin,
  MessageCircle,
  PackageSearch,
  Phone,
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
  restaurants: { name: string } | null;
}
interface HistoryRow {
  id: string;
  status: string;
  note: string | null;
  created_at: string;
}
interface TaskRow {
  id: string;
  driver_id: string | null;
  status: string;
  assigned_at: string | null;
  picked_up_at: string | null;
  delivered_at: string | null;
}
interface Driver {
  id: string;
  full_name: string;
  avatar_url: string | null;
}
interface TrackingData {
  order: Order;
  history: HistoryRow[];
  task: TaskRow | null;
  driver: Driver | null;
  eta: { distanceKm: number | null; etaMinutes: number | null } | null;
}

/** จุดไทม์ไลน์ตามต้นแบบ: สร้างคำสั่ง → ชำระเงิน → ร้านรับ → เตรียมอาหาร → รับอาหาร → กำลังจัดส่ง → ส่งถึงแล้ว */
const STEPS: { key: string; label: string }[] = [
  { key: 'created', label: 'สร้างคำสั่ง' },
  { key: 'pending_payment', label: 'ชำระเงิน' },
  { key: 'restaurant_accepted', label: 'ร้านรับ' },
  { key: 'preparing', label: 'เตรียมอาหาร' },
  { key: 'picked_up', label: 'รับอาหาร' },
  { key: 'delivering', label: 'กำลังจัดส่ง' },
  { key: 'delivered', label: 'ส่งถึงแล้ว' },
];

/** แมปสถานะจริงของออเดอร์ → ดัชนีจุดไทม์ไลน์ที่ "เสร็จแล้ว" */
const STATUS_STEP: Record<string, number> = {
  created: 0,
  pending_payment: 0,
  paid: 1,
  restaurant_pending: 1,
  restaurant_accepted: 2,
  preparing: 3,
  ready_for_pickup: 3,
  driver_assigned: 3,
  driver_arriving_restaurant: 3,
  picked_up: 4,
  delivering: 5,
  delivered: 6,
  completed: 6,
};

/** สถานะที่ยังไม่ควรแสดงการ์ด "กำลังค้นหาไรเดอร์" */
const FINISHED = new Set(['delivered', 'completed', 'cancelled', 'refunded']);

function thaiShortTime(iso: string): string {
  return new Date(iso).toLocaleString('th-TH', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Bangkok',
  });
}

export default function TrackingPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<TrackingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [callOpen, setCallOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // โหลดครั้งแรกแบบเงียบ ๆ ทุก 15 วินาที เพื่ออัปเดตสถานะตอนติดตาม
    const fetchOnce = (silent: boolean) => {
      api<{ data: TrackingData }>(`/api/orders/${id}/tracking`)
        .then((r) => {
          if (!cancelled) {
            setData(r.data);
            setError('');
          }
        })
        .catch((e: Error) => {
          if (!cancelled && !silent) setError(e.message);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    };
    fetchOnce(false);
    const timer = setInterval(() => fetchOnce(true), 15000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [id]);

  if (loading) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="กำลังโหลดสถานะการจัดส่ง">
        <div className="h-11 w-40 animate-pulse rounded-full bg-neutral-100" />
        <div className="h-28 animate-pulse rounded-3xl bg-neutral-100" />
        <div className="h-48 animate-pulse rounded-3xl bg-neutral-100" />
        <div className="h-64 animate-pulse rounded-3xl bg-neutral-100" />
      </div>
    );
  }

  // 404 → สถานะ "ว่าง" ของหน้านี้
  if (error === 'ไม่พบคำสั่งซื้อ') {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <span className="flex h-20 w-20 items-center justify-center rounded-full bg-neutral-100">
          <PackageSearch className="h-9 w-9 text-neutral-300" aria-hidden />
        </span>
        <h1 className="text-lg font-bold text-black">ไม่พบคำสั่งซื้อ</h1>
        <p className="text-sm text-neutral-400">คำสั่งซื้อนี้อาจถูกลบหรือไม่ใช่ของคุณ</p>
        <Link href="/orders" className="btn-brand inline-flex h-11 items-center px-8 text-sm">
          ดูคำสั่งซื้อทั้งหมด
        </Link>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-red-50">
          <PackageSearch className="h-8 w-8 text-red-400" aria-hidden />
        </span>
        <p className="text-sm text-red-500">{error || 'เกิดข้อผิดพลาด กรุณาลองอีกครั้ง'}</p>
        <button
          onClick={() => window.location.reload()}
          className="btn-brand inline-flex h-11 items-center px-8 text-sm"
        >
          ลองอีกครั้ง
        </button>
      </div>
    );
  }

  const { order, history, task, driver } = data;

  // คำนวณจุดไทม์ไลน์จากประวัติ + สถานะปัจจุบัน
  const doneSteps = new Set<number>();
  const timeByStep = new Map<number, string>();
  for (const h of history) {
    const step = STATUS_STEP[h.status];
    if (step !== undefined && !doneSteps.has(step)) {
      doneSteps.add(step);
      timeByStep.set(step, h.created_at);
    }
  }
  const currentIdx = STATUS_STEP[order.status];
  if (currentIdx !== undefined) {
    for (let i = 0; i <= currentIdx; i++) doneSteps.add(i);
  }
  const activeIdx = currentIdx !== undefined ? currentIdx : Math.max(-1, ...doneSteps);
  const nextIdx = doneSteps.size === 0 ? 0 : Math.min(Math.max(...doneSteps) + 1, STEPS.length - 1);

  const showSearching = !task?.driver_id && !FINISHED.has(order.status);
  const canRate = order.status === 'delivered' || order.status === 'completed';
  const driverName = driver?.full_name?.trim() || 'ไรเดอร์ของคุณ';

  return (
    <div className="space-y-4">
      {/* หัว: ย้อนกลับไปรายละเอียดคำสั่งซื้อ */}
      <div className="flex items-center gap-2">
        <Link
          href={`/orders/${id}`}
          aria-label="ย้อนกลับไปรายละเอียดคำสั่งซื้อ"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-line bg-white transition-colors hover:bg-[#FFF4CC]"
        >
          <ChevronLeft className="h-5 w-5 text-black" aria-hidden />
        </Link>
        <h1 className="truncate-1 text-lg font-bold text-black">ติดตามคำสั่งซื้อ</h1>
      </div>

      {/* ETA ค่าประมาณ (v4 ข้อ 3 — ระยะเส้นตรง + ความเร็วเฉลี่ย ไม่ใช่เส้นทางถนนจริง) */}
      {data.eta?.etaMinutes != null && (
        <p className="rounded-2xl bg-[#FFF4CC] px-4 py-3 text-xs leading-relaxed text-black">
          ระยะทางจากร้านถึงจุดส่งประมาณ {data.eta.distanceKm} กม. · ใช้เวลาส่งโดยประมาณ ~
          {data.eta.etaMinutes} นาที (ค่าประมาณจากระยะเส้นตรง ไม่ใช่เส้นทางถนนจริง)
        </p>
      )}

      {/* สรุปสถานะปัจจุบันใหญ่ ๆ */}
      <section
        aria-label="สรุปสถานะปัจจุบัน"
        className={`rounded-3xl p-5 text-center shadow-sm ${STATUS_COLOR[order.status] ?? 'bg-neutral-100 text-neutral-700'}`}
      >
        <p className="text-xs font-medium opacity-70">สถานะปัจจุบัน</p>
        <p className="mt-1 text-2xl font-bold">{STATUS_TH[order.status] ?? order.status}</p>
        <p className="mt-2 text-xs opacity-80">
          คำสั่งซื้อ #{order.order_code} · ร้าน {order.restaurants?.name ?? 'อาหาร'} · {baht(order.total)}
        </p>
      </section>

      {/* แผนที่ — ลิงก์เข้าหน้าแผนที่จริง (MapLibre + OpenStreetMap) */}
      <Link
        href={`/orders/${id}/map`}
        aria-label="เปิดแผนที่เส้นทางจัดส่ง"
        className="flex h-44 flex-col items-center justify-center gap-2 rounded-3xl bg-[#FFF4CC] px-4 text-center transition-transform active:scale-[0.99]"
      >
        <MapPin className="h-7 w-7 text-black" aria-hidden />
        <p className="text-sm font-bold text-black">เปิดแผนที่เส้นทางจัดส่ง</p>
        <p className="text-xs text-black/60">ดูจุดรับ จุดส่ง และตำแหน่งไรเดอร์บนแผนที่จริง</p>
      </Link>

      {/* ไทม์ไลน์แนวตั้ง */}
      <section aria-label="ไทม์ไลน์สถานะคำสั่งซื้อ" className="rounded-3xl border border-line bg-white p-4">
        <ol>
          {STEPS.map((step, i) => {
            const done = doneSteps.has(i);
            const isCurrent = !done && i === nextIdx && activeIdx < STEPS.length - 1;
            const time = timeByStep.get(i);
            return (
              <li key={step.key} className="relative flex gap-3 pb-6 last:pb-0">
                {i < STEPS.length - 1 && (
                  <span
                    aria-hidden
                    className={`absolute left-[13px] top-8 h-[calc(100%-2rem)] w-0.5 ${
                      done && doneSteps.has(i + 1) ? 'bg-[#FFC400]' : 'bg-neutral-200'
                    }`}
                  />
                )}
                <span className="relative z-10 flex h-7 w-7 shrink-0 items-center justify-center">
                  {isCurrent && (
                    <span aria-hidden className="absolute inset-0 animate-pulse rounded-full bg-[#FFC400]/30" />
                  )}
                  {done ? (
                    <CheckCircle2 className="h-6 w-6 text-[#FFC400]" aria-hidden />
                  ) : (
                    <Circle className={`h-6 w-6 ${isCurrent ? 'text-black' : 'text-neutral-300'}`} aria-hidden />
                  )}
                </span>
                <span className="min-w-0 flex-1 pt-0.5">
                  <span
                    className={`block text-sm ${done || isCurrent ? 'font-bold text-black' : 'text-neutral-400'}`}
                  >
                    {step.label}
                  </span>
                  {time && done && (
                    <span className="mt-0.5 block text-[11px] text-neutral-400">{thaiShortTime(time)}</span>
                  )}
                </span>
              </li>
            );
          })}
        </ol>
      </section>

      {/* การ์ดไรเดอร์ / กำลังค้นหาไรเดอร์ */}
      {task?.driver_id ? (
        <section
          aria-label="ข้อมูลไรเดอร์"
          className="flex items-center gap-3 rounded-3xl border border-line bg-white p-4"
        >
          <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-black text-lg font-bold text-[#FFC400]">
            {driver?.avatar_url ? (
              <img src={driver.avatar_url} alt={`รูปไรเดอร์ ${driverName}`} className="h-full w-full object-cover" />
            ) : (
              <Bike className="h-6 w-6" aria-hidden />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate-1 text-sm font-bold text-black">{driverName}</p>
            <p className="text-xs text-neutral-400">ไรเดอร์ของคุณ</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {/* โทร — v3.1 ข้อ 6: ยังไม่เปิดใช้งาน ห้ามเรียก API โทรจริง */}
            <button
              type="button"
              onClick={() => setCallOpen(true)}
              aria-label="โทรไรเดอร์ (ยังไม่เปิดใช้งาน)"
              className="flex h-11 w-11 items-center justify-center rounded-full bg-[#FFC400] text-black transition-transform active:scale-90"
            >
              <Phone className="h-5 w-5" aria-hidden />
            </button>
            <Link
              href="/messages"
              aria-label="ส่งข้อความถึงไรเดอร์"
              className="flex h-11 w-11 items-center justify-center rounded-full bg-black text-[#FFC400] transition-transform active:scale-90"
            >
              <MessageCircle className="h-5 w-5" aria-hidden />
            </Link>
          </div>
        </section>
      ) : showSearching ? (
        <section
          aria-label="กำลังค้นหาไรเดอร์"
          className="flex items-center gap-3 rounded-3xl border border-line bg-white p-4"
        >
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#FFF4CC]">
            <LoaderCircle className="h-6 w-6 animate-spin text-black" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-bold text-black">กำลังค้นหาไรเดอร์...</p>
            <p className="text-xs text-neutral-400">ระบบกำลังจับคู่ไรเดอร์ที่ใกล้ที่สุดให้คุณ</p>
          </div>
        </section>
      ) : null}

      {/* ปุ่มให้คะแนน — เมื่อส่งถึงแล้ว/สำเร็จ */}
      {canRate && (
        <Link
          href={`/orders/${id}/rate`}
          className="btn-brand flex h-12 w-full items-center justify-center text-sm"
        >
          ให้คะแนนคำสั่งซื้อนี้
        </Link>
      )}

      {/* AlertDialog ปุ่มโทร — ตามข้อ 9 */}
      <AlertDialog open={callOpen} onOpenChange={setCallOpen}>
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle>ฟีเจอร์โทรเสียง/วิดีโอ</AlertDialogTitle>
            <AlertDialogDescription>
              ยังไม่เปิดใช้งาน — ระบบโทรเสียง/วิดีโอจะพร้อมใช้เมื่อมีเซิร์ฟเวอร์รองรับ
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row gap-2">
            <AlertDialogCancel className="mt-0 flex-1 rounded-full border-line">ปิด</AlertDialogCancel>
            <AlertDialogAction className="flex-1 rounded-full bg-black text-[#FFC400] hover:bg-black/90">
              เข้าใจแล้ว
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
