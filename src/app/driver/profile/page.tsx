'use client';

import { useCallback, useEffect, useState } from 'react';
import { BadgeCheck, Bike, PackageCheck, Phone, ShieldAlert, Star, Wallet } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { api, baht } from '@/lib/client';
import { DriverFooter, DriverHeader } from '@/components/portal/driver-header';

interface Profile {
  id: string;
  license_number: string | null;
  vehicle_type: string;
  vehicle_plate: string | null;
  is_online: boolean;
  is_verified: boolean;
  rating: number | null;
  total_deliveries: number | null;
  total_earnings: number | null;
}

interface MeUser {
  id: string;
  email: string;
  phone: string | null;
  full_name: string;
  avatar_url: string | null;
}

/** ชื่อยานพาหนะภาษาไทย */
const VEHICLE_TH: Record<string, string> = {
  motorbike: 'มอเตอร์ไซค์',
  car: 'รถยนต์',
  bicycle: 'จักรยาน',
};

export default function DriverProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [me, setMe] = useState<MeUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api<{ profile: Profile; user: MeUser | null }>('/api/driver/profile')
      .then((r) => {
        setProfile(r.profile);
        setMe(r.user);
        setError('');
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  const setOnline = async (next: boolean) => {
    setBusy(true);
    setError('');
    try {
      await api('/api/driver/profile', { method: 'PATCH', body: JSON.stringify({ is_online: next }) });
      setProfile((p) => (p ? { ...p, is_online: next } : p));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const initial = (me?.full_name ?? '?').trim().charAt(0).toUpperCase();

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <DriverHeader />

      <main className="mx-auto w-full max-w-5xl flex-1 space-y-5 px-4 py-5">
        <h1 className="flex items-center gap-2 text-lg font-bold text-black">
          <Bike className="h-5 w-5" aria-hidden /> โปรไฟล์ของฉัน
        </h1>

        {error && (
          <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </p>
        )}

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-28 animate-pulse rounded-3xl bg-neutral-100" />
            ))}
          </div>
        ) : profile ? (
          <>
            {/* การ์ดตัวตน */}
            <section aria-label="ข้อมูลส่วนตัว" className="flex items-center gap-4 rounded-3xl border border-line p-5">
              <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-[#FFC400] text-2xl font-bold text-black">
                {me?.avatar_url ? (
                  <img src={me.avatar_url} alt="" className="h-full w-full rounded-full object-cover" />
                ) : (
                  initial
                )}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate-1 text-base font-bold text-black">{me?.full_name ?? 'ไรเดอร์'}</p>
                  {profile.is_verified ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[#FFF4CC] px-2 py-0.5 text-[11px] font-bold text-black">
                      <BadgeCheck className="h-3.5 w-3.5" aria-hidden /> ยืนยันแล้ว
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-bold text-neutral-500">
                      <ShieldAlert className="h-3.5 w-3.5" aria-hidden /> รอยืนยัน
                    </span>
                  )}
                </div>
                <p className="mt-0.5 flex items-center gap-1 text-sm text-neutral-500">
                  <Phone className="h-3.5 w-3.5" aria-hidden /> {me?.phone ?? 'ไม่มีเบอร์โทร'}
                </p>
                <p className="truncate-1 text-[11px] text-neutral-400">{me?.email}</p>
              </div>
            </section>

            {/* สถิติ */}
            <section aria-label="สถิติของฉัน" className="grid grid-cols-3 gap-3">
              {[
                { label: 'คะแนนเฉลี่ย', value: (profile.rating ?? 0).toFixed(1), Icon: Star },
                { label: 'จำนวนงาน', value: String(profile.total_deliveries ?? 0), Icon: PackageCheck },
                { label: 'รายได้รวม', value: baht(Number(profile.total_earnings ?? 0)), Icon: Wallet },
              ].map(({ label, value, Icon }) => (
                <div key={label} className="rounded-3xl border border-line bg-white p-4 text-center">
                  <Icon className="mx-auto h-5 w-5 text-black" aria-hidden />
                  <p className="mt-1 text-lg font-bold text-black">{value}</p>
                  <p className="text-[11px] text-neutral-500">{label}</p>
                </div>
              ))}
            </section>

            {/* ข้อมูลยานพาหนะ */}
            <section aria-label="ข้อมูลยานพาหนะ" className="rounded-3xl border border-line p-5">
              <h2 className="mb-3 text-sm font-bold text-black">ยานพาหนะของฉัน</h2>
              <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
                <div>
                  <dt className="text-xs text-neutral-400">ประเภท</dt>
                  <dd className="font-bold text-black">{VEHICLE_TH[profile.vehicle_type] ?? profile.vehicle_type}</dd>
                </div>
                <div>
                  <dt className="text-xs text-neutral-400">เลขที่ใบขับขี่</dt>
                  <dd className="font-bold text-black">{profile.license_number ?? 'ไม่ระบุ'}</dd>
                </div>
                <div>
                  <dt className="text-xs text-neutral-400">เลขทะเบียน</dt>
                  <dd className="font-bold text-black">{profile.vehicle_plate ?? 'ไม่ระบุ'}</dd>
                </div>
              </dl>
            </section>

            {/* สวิตช์เปิดรับงาน */}
            <section
              aria-label="สถานะรับงาน"
              className={`flex items-center justify-between rounded-3xl border p-5 ${
                profile.is_online ? 'border-[#FFC400] bg-[#FFF4CC]' : 'border-line bg-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <span
                  className={`flex h-12 w-12 items-center justify-center rounded-2xl ${
                    profile.is_online ? 'bg-black text-[#FFC400]' : 'bg-neutral-100 text-neutral-400'
                  }`}
                >
                  <Bike className="h-6 w-6" aria-hidden />
                </span>
                <div>
                  <p className="text-sm font-bold text-black">{profile.is_online ? 'เปิดรับงาน' : 'ปิดรับงาน'}</p>
                  <p className="text-xs text-neutral-500">
                    {profile.is_online ? 'งานใหม่จะเข้าที่หน้าหลักเมื่อร้านพร้อมส่ง' : 'เปิดสวิตช์เพื่อเริ่มรับงาน'}
                  </p>
                </div>
              </div>
              <Switch checked={profile.is_online} disabled={busy} onCheckedChange={(v) => void setOnline(v)} aria-label="เปิดปิดรับงาน" />
            </section>
          </>
        ) : (
          <div className="rounded-3xl border border-dashed border-line px-4 py-10 text-center">
            <Bike className="mx-auto h-8 w-8 text-neutral-300" aria-hidden />
            <p className="mt-2 text-sm text-neutral-400">ยังไม่มีโปรไฟล์ไรเดอร์สำหรับบัญชีนี้</p>
          </div>
        )}
      </main>

      <DriverFooter />
    </div>
  );
}
