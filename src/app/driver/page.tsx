'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Bell,
  ChevronRight,
  Flame,
  Gift,
  HeartHandshake,
  Landmark,
  LifeBuoy,
  MapPin,
  Navigation,
  Phone,
  PhoneIncoming,
  PhoneOff,
  Power,
  RefreshCw,
  Settings,
  ShieldCheck,
  Star,
  UserRound,
  Wallet,
  PackageCheck,
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { api, baht, STATUS_TH } from '@/lib/client';
import { sendRejectedToRoom, useIncomingRing } from '@/lib/calls';
import { DriverFooter, DriverHeader } from '@/components/portal/driver-header';

interface DriverMe {
  driver: {
    id: string;
    vehicle_type: string;
    vehicle_plate: string;
    is_online: boolean;
    rating: number | null;
    total_deliveries: number | null;
    total_earnings: number | null;
  };
  fullName: string;
}

interface Task {
  id: string;
  order_code: string;
  status: string;
  delivery_fee: number;
  restaurantName: string;
  restaurantAddress: string;
  dropoffAddress: string;
  dropoffLabel: string | null;
  created_at: string;
}

const NEXT_ACTION: Record<string, { action: string; label: string }> = {
  driver_assigned: { action: 'pickup', label: 'รับอาหารจากร้านแล้ว' },
  picked_up: { action: 'deliver', label: 'ส่งถึงลูกค้าแล้ว' },
};

export default function DriverPortalPage() {
  const router = useRouter();
  const [me, setMe] = useState<DriverMe | null>(null);
  const [available, setAvailable] = useState<Task[]>([]);
  const [mine, setMine] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [tick, setTick] = useState(0);
  const [lastGpsAt, setLastGpsAt] = useState<number | null>(null);

  const load = useCallback(() => {
    Promise.all([
      api<DriverMe>('/api/driver/me'),
      api<{ available: Task[]; mine: Task[] }>('/api/driver/tasks'),
    ])
      .then(([m, t]) => {
        setMe(m);
        setAvailable(t.available);
        setMine(t.mine);
        setError('');
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load, tick]);

  // งานใหม่เข้าอัตโนมัติทุก 12 วินาที
  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 12000);
    return () => clearInterval(t);
  }, []);

  const setOnline = async (next: boolean) => {
    setBusy(true);
    setError('');
    try {
      await api('/api/driver/me', { method: 'PATCH', body: JSON.stringify({ isOnline: next }) });
      setMe((m) => (m ? { ...m, driver: { ...m.driver, is_online: next } } : m));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const act = async (orderId: string, action: string) => {
    setBusy(true);
    setError('');
    try {
      await api('/api/driver/tasks', { method: 'POST', body: JSON.stringify({ orderId, action }) });
      setTick((x) => x + 1);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const online = me?.driver.is_online ?? false;

  // กริ่งสายเรียกเข้า (ระบบโทรจบในระบบ) — ฟังช่อง ring ส่วนตัวเสมอ รับ/ปฏิเสธได้จากพอร์ทัลไรเดอร์
  const incomingCall = useIncomingRing(true);

  const acceptCall = () => {
    if (!incomingCall) return;
    router.push(`/calls/${encodeURIComponent(incomingCall.room)}?order=${encodeURIComponent(incomingCall.orderId)}`);
  };

  const rejectCall = () => {
    if (!incomingCall) return;
    void sendRejectedToRoom(incomingCall.room); // แจ้งห้องโทรให้ผู้ฝั่งโทรเห็นว่าถูกปฏิเสธ
  };

  // ส่งพิกัด GPS ทุก 15 วินาทีขณะเปิดรับงาน — หยุดเมื่อปิดรับงาน และพักเมื่อหน้าถูกซ่อน
  useEffect(() => {
    if (!online) return;
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      console.warn('เบราว์เซอร์นี้ไม่รองรับการระบุตำแหน่ง');
      return;
    }
    const send = () => {
      if (document.visibilityState === 'hidden') return;
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          api('/api/driver/location', {
            method: 'PATCH',
            body: JSON.stringify({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
          })
            .then(() => setLastGpsAt(Date.now()))
            .catch((e) => console.warn('ส่งพิกัดไม่สำเร็จ:', e));
        },
        (err) => console.warn('อ่านพิกัดไม่สำเร็จ:', err.message),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 20000 },
      );
    };
    send();
    const t = setInterval(send, 15000);
    return () => clearInterval(t);
  }, [online]);

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <DriverHeader />

      <main className="mx-auto w-full max-w-5xl flex-1 space-y-6 px-4 py-5">
        {error && (
          <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </p>
        )}

        <div className="flex items-center justify-between gap-2">
          <h1 className="text-lg font-bold text-black">งานของฉัน</h1>
          <button
            onClick={() => void load()}
            className="flex items-center gap-1.5 rounded-full border border-line px-3 py-2 text-xs font-semibold text-neutral-600 transition-colors hover:bg-neutral-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} aria-hidden /> รีเฟรช
          </button>
        </div>

        {/* สวิตช์เปิดรับงาน */}
        <section aria-label="สถานะรับงาน" className={`flex items-center justify-between rounded-3xl border p-5 ${online ? 'border-[#FFC400] bg-[#FFF4CC]' : 'border-line bg-white'}`}>
          <div className="flex items-center gap-3">
            <span className={`flex h-12 w-12 items-center justify-center rounded-2xl ${online ? 'bg-black text-[#FFC400]' : 'bg-neutral-100 text-neutral-400'}`}>
              <Power className="h-6 w-6" aria-hidden />
            </span>
            <div>
              <p className="text-sm font-bold text-black">{online ? 'เปิดรับงาน' : 'ปิดรับงาน'}</p>
              <p className="text-xs text-neutral-500">{online ? 'งานใหม่จะเข้าที่นี่เมื่อร้านพร้อมส่ง' : 'เปิดสวิตช์เพื่อเริ่มรับงาน'}</p>
              {lastGpsAt !== null && (
                <p className="mt-0.5 text-[11px] text-neutral-400">
                  พิกัด: ส่งล่าสุด{' '}
                  {new Date(lastGpsAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
                </p>
              )}
            </div>
          </div>
          <Switch
            checked={online}
            disabled={busy || !me}
            onCheckedChange={(v) => void setOnline(v)}
            aria-label="เปิดปิดรับงาน"
          />
        </section>

        {/* สถิติ */}
        <section aria-label="สถิติของฉัน" className="grid grid-cols-3 gap-3">
          {[
            { label: 'คะแนนเฉลี่ย', value: me ? (me.driver.rating ?? 0).toFixed(1) : '–', Icon: Star },
            { label: 'ส่งสำเร็จ', value: me ? String(me.driver.total_deliveries ?? 0) : '–', Icon: PackageCheck },
            { label: 'รายได้รวม', value: me ? baht(Number(me.driver.total_earnings ?? 0)) : '–', Icon: Wallet },
          ].map(({ label, value, Icon }) => (
            <div key={label} className="rounded-3xl border border-line bg-white p-4 text-center">
              <Icon className="mx-auto h-5 w-5 text-black" aria-hidden />
              <p className="mt-1 text-lg font-bold text-black">{value}</p>
              <p className="text-[11px] text-neutral-500">{label}</p>
            </div>
          ))}
        </section>

        {/* เมนูพอร์ทัลไรเดอร์ */}
        <section aria-label="เมนูไรเดอร์">
          <h2 className="mb-2 text-sm font-bold text-black">เมนูของฉัน</h2>
          <div className="grid grid-cols-3 gap-3">
            {[
              { href: '/driver/heatmap', label: 'แผนที่ความต้องการ', Icon: Flame },
              { href: '/driver/notifications', label: 'แจ้งเตือน', Icon: Bell },
              { href: '/driver/profile', label: 'โปรไฟล์', Icon: UserRound },
              { href: '/driver/support', label: 'ช่วยเหลือ', Icon: LifeBuoy },
              { href: '/driver/bank', label: 'บัญชีธนาคาร', Icon: Landmark },
              { href: '/driver/kyc', label: 'ยืนยันตัวตน', Icon: ShieldCheck },
              { href: '/driver/ratings', label: 'คะแนน', Icon: Star },
              { href: '/driver/incentives', label: 'โบนัส', Icon: Gift },
              { href: '/driver/tips', label: 'ทิป', Icon: HeartHandshake },
              { href: '/driver/settings', label: 'ตั้งค่า', Icon: Settings },
            ].map(({ href, label, Icon }) => (
              <Link
                key={href}
                href={href}
                className="flex flex-col items-center gap-1.5 rounded-3xl border border-line bg-white p-4 text-center transition-colors hover:border-[#FFC400] hover:bg-[#FFF4CC]"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#FFF4CC] text-black">
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
                <span className="text-[11px] font-bold text-black">{label}</span>
              </Link>
            ))}
          </div>
        </section>

        {/* งานของฉัน */}
        <section aria-label="งานที่กำลังทำ">
          <h2 className="mb-2 flex items-center gap-2 text-sm font-bold text-black">
            งานของฉัน
            {mine.length > 0 && <span className="rounded-full bg-black px-2 py-0.5 text-[11px] font-bold text-[#FFC400]">{mine.length}</span>}
          </h2>
          {mine.length === 0 ? (
            <p className="rounded-3xl border border-dashed border-line px-4 py-6 text-center text-sm text-neutral-300">ยังไม่มีงานที่รับไว้</p>
          ) : (
            <ul className="space-y-3">
              {mine.map((t) => (
                <TaskCard key={t.id} task={t} busy={busy} onAct={act} />
              ))}
            </ul>
          )}
        </section>

        {/* งานพร้อมรับ */}
        <section aria-label="งานพร้อมรับ">
          <h2 className="mb-2 flex items-center gap-2 text-sm font-bold text-black">
            งานพร้อมรับ
            {available.length > 0 && <span className="rounded-full bg-[#FFC400] px-2 py-0.5 text-[11px] font-bold text-black">{available.length} งานใหม่</span>}
          </h2>
          {available.length === 0 ? (
            <p className="rounded-3xl border border-dashed border-line px-4 py-6 text-center text-sm text-neutral-300">
              ไม่มีงานรอไรเดอร์ตอนนี้
            </p>
          ) : (
            <ul className="space-y-3">
              {available.map((t) => (
                <TaskCard key={t.id} task={t} busy={busy} onAct={act} />
              ))}
            </ul>
          )}
        </section>
      </main>

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

      <DriverFooter />
    </div>
  );
}

function TaskCard({ task, busy, onAct }: { task: Task; busy: boolean; onAct: (id: string, action: string) => void }) {
  const isAvailableTask = task.status === 'ready_for_pickup';
  const next = NEXT_ACTION[task.status];
  return (
    <li className={`rounded-3xl border bg-white p-4 shadow-sm ${isAvailableTask ? 'border-[#FFC400]' : 'border-line'}`}>
      <div className="flex items-center justify-between gap-2">
        <Link
          href={`/driver/trips/${task.id}`}
          className="flex min-w-0 items-center gap-2 transition-opacity hover:opacity-70"
          aria-label={`ดูรายละเอียดงาน #${task.order_code}`}
        >
          <span className="text-sm font-bold text-black">#{task.order_code}</span>
          <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${isAvailableTask ? 'bg-[#FFC400] text-black' : 'bg-neutral-100 text-neutral-700'}`}>
            {STATUS_TH[task.status] ?? task.status}
          </span>
          <ChevronRight className="h-4 w-4 shrink-0 text-neutral-400" aria-hidden />
        </Link>
      </div>
      <div className="mt-2 space-y-1.5 text-sm">
        <p className="flex items-start gap-2 text-neutral-700">
          <Navigation className="mt-0.5 h-4 w-4 shrink-0 text-black" aria-hidden />
          <span>
            <b>รับ:</b> {task.restaurantName} — {task.restaurantAddress}
          </span>
        </p>
        <p className="flex items-start gap-2 text-neutral-700">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-black" aria-hidden />
          <span>
            <b>ส่ง:</b> {task.dropoffLabel ? `${task.dropoffLabel} · ` : ''}
            {task.dropoffAddress || 'ไม่มีที่อยู่'}
          </span>
        </p>
      </div>
      <div className="mt-2 flex items-center justify-between">
        <span className="text-xs text-neutral-400">ค่าส่ง {baht(task.delivery_fee)}</span>
        <button
          onClick={() => onAct(task.id, isAvailableTask ? 'accept' : next!.action)}
          disabled={busy || (isAvailableTask && task.status === 'ready_for_pickup' && false)}
          className={`flex h-11 items-center gap-2 rounded-full px-5 text-sm font-bold transition-all active:scale-95 disabled:opacity-50 ${
            isAvailableTask ? 'bg-[#FFC400] text-black hover:bg-[#e6b000]' : 'btn-brand'
          }`}
        >
          {isAvailableTask ? 'รับงานนี้' : next!.label}
        </button>
      </div>
    </li>
  );
}
