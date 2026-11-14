'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import {
  ArrowLeft,
  Car,
  Clock,
  CreditCard,
  FileText,
  ScanLine,
  ShieldCheck,
} from 'lucide-react';
import { api, useSession } from '@/lib/client';

interface KycData {
  profile: {
    licenseNumber: string;
    vehiclePlate: string;
    maxRadiusKm: number | null;
    termsAccepted: boolean;
  };
  latest: { id: string; status: 'pending' | 'approved' | 'rejected' } | null;
}

interface KycDoc {
  type: string;
  label: string;
  url: string;
}

// เอกสารที่ต้องแนบ 4 รายการ — ไม่มีคลาวด์สตอเรจในโอเพนซอร์ส จึงใช้ลิงก์รูปภาพ (https://)
const DOC_ITEMS: { icon: typeof CreditCard; type: string; label: string }[] = [
  { icon: CreditCard, type: 'id_card_front', label: 'บัตรประชาชน (ด้านหน้า)' },
  { icon: ScanLine, type: 'id_card_back', label: 'บัตรประชาชน (ด้านหลัง)' },
  { icon: FileText, type: 'driver_license', label: 'ใบอนุญาตขับขี่' },
  { icon: Car, type: 'vehicle_registration', label: 'ทะเบียนรถ' },
];

/** หน้าเอกสารยืนยันตัวตน — ขั้นตอนที่ 3 ของการสมัคร (ส่งผ่าน POST /api/driver/kyc ที่มีอยู่แล้ว) */
export default function DriverDocumentsPage() {
  const router = useRouter();
  const { user, ready, refresh } = useSession();
  const [license, setLicense] = useState('');
  const [plate, setPlate] = useState('');
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [pendingBlocked, setPendingBlocked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    // GET KYC ก่อนเสมอ: เช็กคำขอที่รอตรวจอยู่ + prefill ข้อมูลจากโปรไฟล์
    api<KycData>('/api/driver/kyc')
      .then((d) => {
        setLicense(d.profile.licenseNumber);
        setPlate(d.profile.vehiclePlate);
        setPendingBlocked(d.latest?.status === 'pending');
        setError('');
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);
  useEffect(load, [load]);

  const submit = async () => {
    setError('');

    const documents: KycDoc[] = [];
    for (const item of DOC_ITEMS) {
      const url = (urls[item.type] ?? '').trim();
      if (url === '') continue;
      if (!/^https?:\/\//i.test(url)) {
        setError(`ลิงก์รูป${item.label}ไม่ถูกต้อง — ต้องขึ้นต้นด้วย https://`);
        return;
      }
      documents.push({ type: item.type, label: item.label, url });
    }
    if (documents.length === 0) {
      setError('กรุณาวางลิงก์รูปเอกสารอย่างน้อย 1 รายการ');
      return;
    }

    setBusy(true);
    try {
      await api('/api/driver/kyc', {
        method: 'POST',
        body: JSON.stringify({
          licenseNumber: license.trim(),
          vehiclePlate: plate.trim().toUpperCase(),
          termsAccepted: true, // ยอมรับไปแล้วในขั้นตอนข้อตกลง
          documents,
        }),
      });
      router.push('/driver/kyc');
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
            href="/driver/onboarding/vehicle"
            aria-label="ย้อนกลับไปยานพาหนะ"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-neutral-100 transition-transform active:scale-95"
          >
            <ArrowLeft className="h-5 w-5" aria-hidden />
          </Link>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#FFC400] text-black">
            <FileText className="h-5 w-5" aria-hidden />
          </span>
          <h1 className="text-sm font-bold text-black">เอกสารยืนยันตัวตน</h1>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 space-y-4 px-4 py-5">
        {error && <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}

        {loading ? (
          <div className="h-72 animate-pulse rounded-3xl bg-neutral-100" />
        ) : pendingBlocked ? (
          /* มีคำขอที่รอตรวจอยู่ — ไม่ให้ส่งซ้ำ (สถานะเดียวกับ 409 จาก API) */
          <section aria-label="รอตรวจสอบ" className="rounded-3xl border border-[#FFC400] bg-[#FFF4CC] p-5">
            <p className="flex items-center gap-2 text-sm font-bold text-black">
              <Clock className="h-5 w-5" aria-hidden /> คุณมีคำขอยืนยันตัวตนที่กำลังรอตรวจสอบอยู่
            </p>
            <p className="mt-1 text-xs leading-relaxed text-neutral-700">
              ไม่ต้องส่งเอกสารซ้ำ — โปรดรอทีมงานตรวจ ติดตามสถานะได้ที่หน้า KYC
            </p>
            <Link
              href="/driver/kyc"
              className="btn-brand mt-4 flex h-12 w-full items-center justify-center text-sm"
              data-testid="documents-view-kyc"
            >
              ไปที่หน้า KYC
            </Link>
          </section>
        ) : (
          <>
            {/* เช็กลิสต์เอกสาร */}
            <section aria-label="เช็กลิสต์เอกสาร" className="rounded-3xl border border-line bg-white">
              <h2 className="border-b border-line px-4 py-3 text-xs font-bold uppercase tracking-wide text-neutral-400">
                เช็กลิสต์เอกสาร (แนบอย่างน้อย 1 รายการ)
              </h2>
              <ul>
                {DOC_ITEMS.map((item, i) => (
                  <li key={item.type} className={`px-4 py-3 ${i > 0 ? 'border-t border-line' : ''}`}>
                    <label className="block space-y-1.5">
                      <span className="flex items-center gap-2 text-xs font-bold text-black">
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#FFF4CC]">
                          <item.icon className="h-4 w-4 text-black" aria-hidden />
                        </span>
                        {item.label}
                      </span>
                      <input
                        value={urls[item.type] ?? ''}
                        onChange={(e) => setUrls((prev) => ({ ...prev, [item.type]: e.target.value }))}
                        inputMode="url"
                        data-testid={`doc-url-${item.type}`}
                        placeholder="https://..."
                        className="h-11 w-full rounded-2xl border border-line bg-neutral-50 px-3 text-sm text-black placeholder:text-neutral-300"
                      />
                      <span className="block text-[11px] text-neutral-400">วางลิงก์รูปภาพ (https://)</span>
                    </label>
                  </li>
                ))}
              </ul>
            </section>

            {/* ข้อมูลยานพาหนะ (prefill จากขั้นตอนก่อนหน้า) */}
            <section aria-label="ข้อมูลยานพาหนะ" className="space-y-3 rounded-3xl border border-line bg-white p-4">
              <label className="block space-y-1">
                <span className="text-xs font-bold text-black">หมายเลขใบขับขี่</span>
                <input
                  value={license}
                  onChange={(e) => setLicense(e.target.value)}
                  maxLength={30}
                  data-testid="documents-license"
                  placeholder="เช่น 11-2-1234567-8"
                  className="h-12 w-full rounded-2xl border border-line bg-neutral-50 px-3 text-sm text-black placeholder:text-neutral-300"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-bold text-black">ทะเบียนรถ</span>
                <input
                  value={plate}
                  onChange={(e) => setPlate(e.target.value.toUpperCase())}
                  maxLength={30}
                  data-testid="documents-plate"
                  placeholder="เช่น 1กก 1234"
                  className="h-12 w-full rounded-2xl border border-line bg-neutral-50 px-3 text-sm uppercase text-black placeholder:text-neutral-300 placeholder:normal-case"
                />
              </label>
              <p className="text-[11px] leading-relaxed text-neutral-400">
                ระบบไม่มีคลาวด์สตอเรจ จึงรับเป็นลิงก์รูปภาพเท่านั้น — ทีมงานจะตรวจสอบลิงก์ที่ส่งมา
              </p>
              <button
                type="button"
                onClick={() => void submit()}
                disabled={busy}
                data-testid="documents-submit"
                className="btn-brand h-12 w-full text-sm disabled:opacity-50"
              >
                {busy ? 'กำลังส่งคำขอ...' : 'ส่งคำขอยืนยันตัวตน'}
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
