'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Bike, CircleAlert, ShieldCheck } from 'lucide-react';
import { api, useSession } from '@/lib/client';

interface OnboardingStatus {
  termsAcceptedAt: string | null;
  termsVersion: string | null;
  licenseNumber: string | null;
  vehiclePlate: string | null;
  vehicleType: string | null;
  kycStatus: 'pending' | 'approved' | 'rejected' | null;
}

const VEHICLE_TYPES: { value: string; label: string; hint: string }[] = [
  { value: 'motorbike', label: 'มอเตอร์ไซค์', hint: 'รถจักรยานยนต์ทั่วไป' },
  { value: 'car', label: 'รถยนต์', hint: 'รถเก๋ง / กระบะ' },
  { value: 'bicycle', label: 'จักรยาน', hint: 'จักรยานหรือจักรยานไฟฟ้า' },
];

/** หน้าข้อมูลยานพาหนะ — ขั้นตอนที่ 2 ของการสมัคร (บันทึกผ่าน PATCH /api/driver/me ที่มีอยู่แล้ว) */
export default function DriverVehiclePage() {
  const router = useRouter();
  const { user, ready, refresh } = useSession();
  const [vehicleType, setVehicleType] = useState('motorbike');
  const [license, setLicense] = useState('');
  const [plate, setPlate] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api<OnboardingStatus>('/api/driver/onboarding')
      .then((d) => {
        setLicense(d.licenseNumber ?? '');
        setPlate(d.vehiclePlate ?? '');
        if (d.vehicleType && ['motorbike', 'car', 'bicycle'].includes(d.vehicleType)) {
          setVehicleType(d.vehicleType);
        }
        setError('');
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);
  useEffect(load, [load]);

  const save = async () => {
    setError('');
    const lic = license.trim();
    const plt = plate.trim().toUpperCase();
    if (lic.length < 4) {
      setError('กรุณาระบุหมายเลขใบขับขี่อย่างน้อย 4 ตัวอักษร');
      return;
    }
    if (plt.length < 3) {
      setError('กรุณาระบุทะเบียนรถอย่างน้อย 3 ตัวอักษร');
      return;
    }
    setBusy(true);
    try {
      await api('/api/driver/me', {
        method: 'PATCH',
        body: JSON.stringify({ vehicleType, licenseNumber: lic, vehiclePlate: plt }),
      });
      router.push('/driver/onboarding/documents');
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  if (!ready || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <p className="text-sm text-neutral-400">กำลังโหลด…</p>
      </div>
    );
  }
  if (user.role !== 'driver') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-white px-4 text-center">
        <ShieldCheck className="h-10 w-10 text-neutral-300" aria-hidden />
        <p className="text-sm font-bold text-black">เฉพาะไรเดอร์เท่านั้น</p>
        <p className="text-xs text-neutral-400">กรุณาเข้าสู่ระบบด้วยบัญชีไรเดอร์</p>
        <Link href="/login" className="btn-brand mt-2 flex h-11 w-48 items-center justify-center text-sm">
          ไปเข้าสู่ระบบ
        </Link>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <header className="sticky top-0 z-40 border-b border-line bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-2 px-4">
          <Link
            href="/driver/onboarding/agreement"
            aria-label="ย้อนกลับไปข้อตกลง"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-neutral-100 transition-transform active:scale-95"
          >
            <ArrowLeft className="h-5 w-5" aria-hidden />
          </Link>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#FFC400] text-black">
            <Bike className="h-5 w-5" aria-hidden />
          </span>
          <h1 className="text-sm font-bold text-black">ยานพาหนะของฉัน</h1>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 space-y-4 px-4 py-5">
        {error && <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}

        {loading ? (
          <div className="h-72 animate-pulse rounded-3xl bg-neutral-100" />
        ) : (
          <>
            {/* เลือกประเภทรถ — enum จริงรองรับครบ 3 ประเภท */}
            <section aria-label="ประเภทยานพาหนะ" className="rounded-3xl border border-line bg-white">
              <h2 className="border-b border-line px-4 py-3 text-xs font-bold uppercase tracking-wide text-neutral-400">
                ประเภทยานพาหนะ
              </h2>
              <div className="space-y-2 p-4">
                {VEHICLE_TYPES.map((v) => {
                  const active = vehicleType === v.value;
                  return (
                    <label
                      key={v.value}
                      className={`flex items-center gap-3 rounded-2xl border-2 px-3 py-3 transition-colors ${
                        active ? 'border-black bg-[#FFF4CC]' : 'border-line bg-white'
                      }`}
                    >
                      <input
                        type="radio"
                        name="vehicle-type"
                        checked={active}
                        onChange={() => setVehicleType(v.value)}
                        className="h-4 w-4 accent-black"
                      />
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#FFC400]">
                        <Bike className="h-5 w-5 text-black" aria-hidden />
                      </span>
                      <span className="flex-1">
                        <span className="block text-sm font-bold text-black">{v.label}</span>
                        <span className="block text-[11px] text-neutral-500">{v.hint}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </section>

            {/* ใบขับขี่ + ทะเบียนรถ */}
            <section aria-label="ข้อมูลการขับขี่" className="space-y-3 rounded-3xl border border-line bg-white p-4">
              <label className="block space-y-1">
                <span className="text-xs font-bold text-black">หมายเลขใบขับขี่</span>
                <input
                  value={license}
                  onChange={(e) => setLicense(e.target.value)}
                  maxLength={30}
                  inputMode="text"
                  data-testid="vehicle-license"
                  placeholder="เช่น 11-2-1234567-8"
                  className="h-12 w-full rounded-2xl border border-line bg-white px-3 text-sm text-black placeholder:text-neutral-300"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-bold text-black">ทะเบียนรถ</span>
                <input
                  value={plate}
                  onChange={(e) => setPlate(e.target.value.toUpperCase())}
                  maxLength={30}
                  data-testid="vehicle-plate"
                  placeholder="เช่น 1กก 1234"
                  className="h-12 w-full rounded-2xl border border-line bg-white px-3 text-sm uppercase text-black placeholder:text-neutral-300 placeholder:normal-case"
                />
              </label>
              <button
                type="button"
                onClick={() => void save()}
                disabled={busy}
                data-testid="vehicle-save"
                className="btn-brand h-12 w-full text-sm disabled:opacity-50"
              >
                {busy ? 'กำลังบันทึก...' : 'บันทึกและไปต่อ'}
              </button>
            </section>
          </>
        )}
      </main>

      <footer className="mt-auto border-t border-line bg-white pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-4 text-center text-xs text-neutral-400">
        © {new Date().getFullYear()} ฟู๊ด ธันเดอร์ — พอร์ทัลไรเดอร์
      </footer>
    </div>
  );
}
