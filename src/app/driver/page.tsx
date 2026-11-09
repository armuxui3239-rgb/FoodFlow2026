'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Bike,
  MapPin,
  Navigation,
  LogOut,
  Power,
  RefreshCw,
  Star,
  Wallet,
  PackageCheck,
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { api, baht, STATUS_TH } from '@/lib/client';

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
  const [me, setMe] = useState<DriverMe | null>(null);
  const [available, setAvailable] = useState<Task[]>([]);
  const [mine, setMine] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [tick, setTick] = useState(0);

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

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <header className="sticky top-0 z-40 border-b border-line bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-4">
          <div className="flex min-w-0 items-center gap-2">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#FFC400] text-black">
              <Bike className="h-5 w-5" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="truncate-1 text-sm font-bold text-black">{me?.fullName ?? 'พอร์ทัลไรเดอร์'}</p>
              <p className="text-[11px] text-neutral-400">
                {me?.driver.vehicle_type === 'motorbike' ? 'มอเตอร์ไซค์' : me?.driver.vehicle_type ?? ''} · {me?.driver.vehicle_plate}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => void load()}
              aria-label="รีเฟรช"
              className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-neutral-100"
            >
              <RefreshCw className={`h-5 w-5 text-neutral-500 ${loading ? 'animate-spin' : ''}`} aria-hidden />
            </button>
            <button
              onClick={() => {
                api('/api/auth/logout', { method: 'POST' }).catch(() => {});
                window.location.href = '/login';
              }}
              aria-label="ออกจากระบบ"
              className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-neutral-100"
            >
              <LogOut className="h-5 w-5 text-neutral-500" aria-hidden />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 space-y-6 px-4 py-5">
        {error && (
          <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </p>
        )}

        {/* สวิตช์เปิดรับงาน */}
        <section aria-label="สถานะรับงาน" className={`flex items-center justify-between rounded-3xl border p-5 ${online ? 'border-[#FFC400] bg-[#FFF4CC]' : 'border-line bg-white'}`}>
          <div className="flex items-center gap-3">
            <span className={`flex h-12 w-12 items-center justify-center rounded-2xl ${online ? 'bg-black text-[#FFC400]' : 'bg-neutral-100 text-neutral-400'}`}>
              <Power className="h-6 w-6" aria-hidden />
            </span>
            <div>
              <p className="text-sm font-bold text-black">{online ? 'เปิดรับงาน' : 'ปิดรับงาน'}</p>
              <p className="text-xs text-neutral-500">{online ? 'งานใหม่จะเข้าที่นี่เมื่อร้านพร้อมส่ง' : 'เปิดสวิตช์เพื่อเริ่มรับงาน'}</p>
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

      <footer className="mt-auto border-t border-line bg-white pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-4 text-center text-xs text-neutral-400">
        © {new Date().getFullYear()} ฟู๊ด ธันเดอร์ — พอร์ทัลไรเดอร์
      </footer>
    </div>
  );
}

function TaskCard({ task, busy, onAct }: { task: Task; busy: boolean; onAct: (id: string, action: string) => void }) {
  const isAvailableTask = task.status === 'ready_for_pickup';
  const next = NEXT_ACTION[task.status];
  return (
    <li className={`rounded-3xl border bg-white p-4 shadow-sm ${isAvailableTask ? 'border-[#FFC400]' : 'border-line'}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-bold text-black">#{task.order_code}</span>
        <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${isAvailableTask ? 'bg-[#FFC400] text-black' : 'bg-neutral-100 text-neutral-700'}`}>
          {STATUS_TH[task.status] ?? task.status}
        </span>
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
