'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import {
  ArrowLeft,
  BadgeCheck,
  Ban,
  Clock,
  Coins,
  FileText,
  ScrollText,
  ShieldCheck,
  UtensilsCrossed,
} from 'lucide-react';
import { api, useSession } from '@/lib/client';

interface OnboardingStatus {
  termsAcceptedAt: string | null;
  termsVersion: string | null;
  licenseNumber: string | null;
  vehiclePlate: string | null;
  kycStatus: 'pending' | 'approved' | 'rejected' | null;
}

// สรุปข้อกำหนดและเงื่อนไขสำหรับไรเดอร์ (เวอร์ชันย่อ)
const TERM_BULLETS: { icon: typeof Clock; text: string }[] = [
  { icon: Clock, text: 'รับงานและส่งอาหารให้ตรงเวลา หากมีเหตุให้ล่าช้าต้องแจ้งลูกค้าผ่านระบบทันที' },
  { icon: UtensilsCrossed, text: 'ดูแลอาหารและบรรจุภัณฑ์ให้ปลอดภัย สะอาด ไม่เปิดตรวจหรือทำเสียหายระหว่างการจัดส่ง' },
  { icon: ShieldCheck, text: 'เก็บข้อมูลส่วนตัวของลูกค้าเป็นความลับ ห้ามนำไปใช้นอกวัตถุประสงค์การจัดส่ง' },
  { icon: Coins, text: 'ค่าจัดส่งและทิปที่ได้รับเป็นของไรเดอร์ตามจำนวนที่ระบบแสดง โดยไม่มีค่าใช้จ่ายแอบแฝง' },
  { icon: FileText, text: 'ต้องยื่นเอกสารยืนยันตัวตน (KYC) และข้อมูลยานพาหนะที่ถูกต้องตามความจริงทุกครั้ง' },
  { icon: Ban, text: 'หากฝ่าฝืนข้อตกลงหรือมีการทุจริต ทีมงานมีสิทธิ์ระงับบัญชีของคุณชั่วคราวหรือถาวร' },
];

/** หน้าข้อตกลงไรเดอร์ — ขั้นตอนที่ 1 ของการสมัคร (ข้อตกลง → ยานพาหนะ → เอกสาร) */
export default function DriverAgreementPage() {
  const router = useRouter();
  const { user, ready, refresh } = useSession();
  const [status, setStatus] = useState<OnboardingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api<OnboardingStatus>('/api/driver/onboarding')
      .then((d) => {
        setStatus(d);
        setError('');
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);
  useEffect(load, [load]);

  const accept = async () => {
    setBusy(true);
    setError('');
    try {
      await api('/api/driver/onboarding', { method: 'PATCH', body: JSON.stringify({ termsAccepted: true }) });
      router.push('/driver/onboarding/vehicle');
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

  const accepted = Boolean(status?.termsAcceptedAt);

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
            <ScrollText className="h-5 w-5" aria-hidden />
          </span>
          <h1 className="text-sm font-bold text-black">ข้อตกลงไรเดอร์</h1>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 space-y-4 px-4 py-5">
        {error && <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}

        {loading ? (
          <div className="h-72 animate-pulse rounded-3xl bg-neutral-100" />
        ) : accepted ? (
          /* ยอมรับแล้ว — แสดงสถานะ + ปุ่มไปต่อ */
          <section aria-label="สถานะข้อตกลง" className="rounded-3xl border border-line bg-[#FFF4CC] p-5">
            <p className="flex items-center gap-2 text-sm font-bold text-black">
              <BadgeCheck className="h-5 w-5" aria-hidden /> ยอมรับข้อตกลงแล้ว
            </p>
            <p className="mt-1 text-xs leading-relaxed text-neutral-700">
              {status?.termsAcceptedAt
                ? `ยอมรับเมื่อ ${new Date(status.termsAcceptedAt).toLocaleString('th-TH', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`
                : 'คุณยอมรับข้อกำหนดและเงื่อนไขไรเดอร์แล้ว'}
              {status?.termsVersion ? ` (เวอร์ชัน ${status.termsVersion})` : ''}
            </p>
            <button
              type="button"
              onClick={() => router.push('/driver/onboarding/vehicle')}
              data-testid="agreement-continue"
              className="btn-brand mt-4 h-12 w-full text-sm"
            >
              ไปตั้งค่ายานพาหนะ
            </button>
          </section>
        ) : (
          <>
            {/* สรุปข้อกำหนด */}
            <section aria-label="สรุปข้อกำหนดและเงื่อนไข" className="rounded-3xl border border-line bg-white">
              <h2 className="border-b border-line px-4 py-3 text-xs font-bold uppercase tracking-wide text-neutral-400">
                ข้อกำหนดและเงื่อนไขการเป็นไรเดอร์ (สรุป)
              </h2>
              <ul>
                {TERM_BULLETS.map((b, i) => (
                  <li key={i} className={`flex items-start gap-3 px-4 py-3 ${i > 0 ? 'border-t border-line' : ''}`}>
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#FFF4CC]">
                      <b.icon className="h-4 w-4 text-black" aria-hidden />
                    </span>
                    <span className="text-sm leading-relaxed text-neutral-700">{b.text}</span>
                  </li>
                ))}
              </ul>
              <p className="border-t border-line px-4 py-3 text-[11px] leading-relaxed text-neutral-400">
                ฉบับเต็มของข้อกำหนดและเงื่อนไขพร้อมให้ศึกษาได้จากทีมงานฟู๊ด ธันเดอร์ — เวอร์ชัน v1
              </p>
            </section>

            {/* ติ๊กยอมรับ */}
            <label className="flex items-start gap-2 rounded-2xl bg-neutral-50 px-3 py-3">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                data-testid="agreement-checkbox"
                className="mt-0.5 h-4 w-4 accent-black"
              />
              <span className="text-xs leading-relaxed text-neutral-700">
                ข้าพเจ้าได้อ่านและยอมรับข้อกำหนดและเงื่อนไขการเป็นไรเดอร์ฟู๊ด ธันเดอร์ทุกข้อข้างต้น
              </span>
            </label>
            <button
              type="button"
              onClick={() => void accept()}
              disabled={!agreed || busy}
              data-testid="agreement-accept"
              className="btn-brand h-12 w-full text-sm disabled:opacity-50"
            >
              {busy ? 'กำลังบันทึก...' : 'ยอมรับข้อตกลง'}
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
