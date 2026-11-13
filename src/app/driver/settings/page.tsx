'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, BellRing, Bike, LogOut, Settings } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { api, useSession } from '@/lib/client';

interface DriverMe {
  driver: {
    vehicle_type: string;
    vehicle_plate: string | null;
    license_number: string | null;
    max_delivery_radius_km: number | null;
  };
}

interface NotifyRow {
  id: string;
  event_type: 'order_updates' | 'promotions' | 'new_services';
  enabled: boolean;
}

const NOTIFY_LABEL: Record<NotifyRow['event_type'], string> = {
  order_updates: 'อัปเดตงานและออเดอร์ใหม่',
  promotions: 'โปรโมชั่นและโบนัส',
  new_services: 'บริการใหม่จากฟู๊ด ธันเดอร์',
};

/** หน้าตั้งค่าไรเดอร์ — ยานพาหนะ + พื้นที่ให้บริการ + แจ้งเตือน (PATCH /api/driver/me จริง) */
export default function DriverSettingsPage() {
  const { user, refresh } = useSession();
  const [me, setMe] = useState<DriverMe | null>(null);
  const [notifies, setNotifies] = useState<NotifyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [plate, setPlate] = useState('');
  const [license, setLicense] = useState('');
  const [radius, setRadius] = useState('10');

  const load = useCallback(() => {
    Promise.all([
      api<DriverMe>('/api/driver/me'),
      api<{ data: NotifyRow[] }>('/api/settings/notifications').catch(() => ({ data: [] as NotifyRow[] })),
    ])
      .then(([m, n]) => {
        setMe(m);
        setPlate(m.driver.vehicle_plate ?? '');
        setLicense(m.driver.license_number ?? '');
        setRadius(String(m.driver.max_delivery_radius_km ?? 10));
        setNotifies(n.data);
        setError('');
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  const save = async () => {
    setBusy(true);
    setError('');
    try {
      await api('/api/driver/me', {
        method: 'PATCH',
        body: JSON.stringify({
          vehiclePlate: plate,
          licenseNumber: license,
          maxRadiusKm: Number(radius),
        }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const toggleNotify = async (row: NotifyRow, next: boolean) => {
    setNotifies((rows) => rows.map((r) => (r.id === row.id ? { ...r, enabled: next } : r)));
    try {
      await api('/api/settings/notifications', {
        method: 'PATCH',
        body: JSON.stringify({ eventType: row.event_type, enabled: next }),
      });
    } catch (e) {
      setNotifies((rows) => rows.map((r) => (r.id === row.id ? { ...r, enabled: !next } : r)));
      setError((e as Error).message);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <header className="sticky top-0 z-40 border-b border-line bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-2 px-4">
          <Link
            href="/driver"
            aria-label="ย้อนกลับ"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-neutral-100 transition-transform active:scale-95"
          >
            <ArrowLeft className="h-5 w-5" aria-hidden />
          </Link>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#FFC400] text-black">
            <Settings className="h-5 w-5" aria-hidden />
          </span>
          <h1 className="text-sm font-bold text-black">ตั้งค่าไรเดอร์</h1>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 space-y-5 px-4 py-5">
        {error && <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}
        {saved && <p role="status" className="rounded-2xl bg-[#FFF4CC] px-4 py-3 text-sm text-black">บันทึกเรียบร้อยแล้ว</p>}

        {loading ? (
          <div className="space-y-3">
            <div className="h-56 animate-pulse rounded-3xl bg-neutral-100" />
            <div className="h-40 animate-pulse rounded-3xl bg-neutral-100" />
          </div>
        ) : (
          <>
            {/* บัญชี */}
            <section aria-label="บัญชี" className="space-y-2">
              <h2 className="text-xs font-bold uppercase tracking-wide text-neutral-400">บัญชี</h2>
              <div className="flex items-center gap-3 rounded-3xl border border-line bg-white px-4 py-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#FFF4CC]">
                  <Bike className="h-5 w-5 text-black" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate-1 text-sm font-bold text-black">{user?.fullName ?? '-'}</p>
                  <p className="text-[11px] text-neutral-400">{user?.email ?? ''}</p>
                </div>
              </div>
            </section>

            {/* ยานพาหนะและพื้นที่ให้บริการ */}
            <section aria-label="ยานพาหนะ" className="space-y-3 rounded-3xl border border-line bg-white p-4">
              <h2 className="text-xs font-bold uppercase tracking-wide text-neutral-400">ยานพาหนะและพื้นที่ให้บริการ</h2>
              <label className="block space-y-1">
                <span className="text-xs font-bold text-black">ทะเบียนรถ</span>
                <input
                  value={plate}
                  onChange={(e) => setPlate(e.target.value)}
                  maxLength={30}
                  data-testid="settings-plate"
                  className="h-12 w-full rounded-2xl border border-line bg-white px-3 text-sm text-black"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-bold text-black">เลขใบอนุญาตขับขี่</span>
                <input
                  value={license}
                  onChange={(e) => setLicense(e.target.value)}
                  maxLength={30}
                  data-testid="settings-license"
                  className="h-12 w-full rounded-2xl border border-line bg-white px-3 text-sm text-black"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-bold text-black">รัศมีพื้นที่รับงาน (กม. 1–30)</span>
                <input
                  value={radius}
                  onChange={(e) => setRadius(e.target.value.replace(/[^\d]/g, ''))}
                  inputMode="numeric"
                  maxLength={2}
                  data-testid="settings-radius"
                  className="h-12 w-full rounded-2xl border border-line bg-white px-3 text-sm text-black"
                />
              </label>
              <button
                type="button"
                onClick={() => void save()}
                disabled={busy}
                data-testid="settings-save"
                className="btn-brand h-12 w-full text-sm disabled:opacity-50"
              >
                {busy ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่า'}
              </button>
            </section>

            {/* แจ้งเตือน */}
            <section aria-label="การแจ้งเตือน" className="space-y-2">
              <h2 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-neutral-400">
                <BellRing className="h-3.5 w-3.5" aria-hidden /> การแจ้งเตือน
              </h2>
              <div className="overflow-hidden rounded-3xl border border-line bg-white">
                {notifies.map((r, i) => (
                  <div key={r.id} className={`flex items-center gap-3 px-4 py-4 ${i > 0 ? 'border-t border-line' : ''}`}>
                    <p className="flex-1 text-sm font-medium text-black">{NOTIFY_LABEL[r.event_type] ?? r.event_type}</p>
                    <Switch
                      checked={r.enabled}
                      onCheckedChange={(v) => void toggleNotify(r, v)}
                      aria-label={`เปิด/ปิด ${NOTIFY_LABEL[r.event_type] ?? r.event_type}`}
                      className="data-[state=checked]:bg-black data-[state=unchecked]:bg-neutral-200"
                    />
                  </div>
                ))}
                {notifies.length === 0 && (
                  <p className="px-4 py-4 text-xs text-neutral-400">โหลดการตั้งค่าแจ้งเตือนไม่ได้ในขณะนี้</p>
                )}
              </div>
            </section>

            {/* ออกจากระบบ */}
            <button
              type="button"
              onClick={() => {
                api('/api/auth/logout', { method: 'POST' }).catch(() => {});
                window.location.href = '/login';
              }}
              data-testid="settings-logout"
              className="flex h-12 w-full items-center justify-center gap-2 rounded-full border border-line bg-white text-sm font-semibold text-red-600 transition-colors hover:bg-red-50"
            >
              <LogOut className="h-4.5 w-4.5" aria-hidden /> ออกจากระบบ
            </button>
            <button
              type="button"
              onClick={() => void refresh()}
              className="mx-auto block text-xs text-neutral-400 underline-offset-2 hover:underline"
            >
              รีเฟรชข้อมูลบัญชี
            </button>
          </>
        )}
      </main>

      <footer className="mt-auto border-t border-line bg-white pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-4 text-center text-xs text-neutral-400">
        © {new Date().getFullYear()} ฟู๊ด ธันเดอร์ — พอร์ทัลไรเดอร์
      </footer>
    </div>
  );
}
