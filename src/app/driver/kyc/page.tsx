'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, BadgeCheck, Clock, ShieldCheck, TriangleAlert } from 'lucide-react';
import { api } from '@/lib/client';

interface KycDoc {
  type: string;
  label: string;
  url: string;
}

interface KycSubmission {
  id: string;
  status: 'pending' | 'approved' | 'rejected';
  document_urls: KycDoc[];
  rejection_reason: string | null;
  created_at: string;
}

interface KycData {
  profile: {
    licenseNumber: string;
    vehiclePlate: string;
    maxRadiusKm: number | null;
    termsAccepted: boolean;
  };
  latest: KycSubmission | null;
}

/** หน้ายืนยันตัวตนไรเดอร์ (KYC) — คำขอจริงจาก driver_kyc_submissions */
export default function DriverKycPage() {
  const [data, setData] = useState<KycData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [license, setLicense] = useState('');
  const [plate, setPlate] = useState('');
  const [idCardUrl, setIdCardUrl] = useState('');
  const [licenseUrl, setLicenseUrl] = useState('');
  const [terms, setTerms] = useState(false);

  const load = useCallback(() => {
    api<KycData>('/api/driver/kyc')
      .then((d) => {
        setData(d);
        setLicense(d.profile.licenseNumber);
        setPlate(d.profile.vehiclePlate);
        setError('');
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      const documents: KycDoc[] = [];
      if (idCardUrl.trim()) documents.push({ type: 'id_card', label: 'บัตรประชาชน', url: idCardUrl.trim() });
      if (licenseUrl.trim()) documents.push({ type: 'driver_license', label: 'ใบอนุญาตขับขี่', url: licenseUrl.trim() });
      await api('/api/driver/kyc', {
        method: 'POST',
        body: JSON.stringify({ licenseNumber: license, vehiclePlate: plate, termsAccepted: terms, documents }),
      });
      load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const status = data?.latest?.status ?? null;

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
            <ShieldCheck className="h-5 w-5" aria-hidden />
          </span>
          <h1 className="text-sm font-bold text-black">ยืนยันตัวตนไรเดอร์ (KYC)</h1>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 space-y-4 px-4 py-5">
        <Link
          href="/driver/onboarding/agreement"
          className="block rounded-2xl bg-neutral-50 px-3 py-2.5 text-xs text-neutral-500 transition hover:bg-neutral-100"
          data-testid="kyc-onboarding-link"
        >
          ขั้นตอนสมัคร: <span className="font-bold text-black">ข้อตกลง</span> → ยานพาหนะ → เอกสาร
        </Link>
        {error && <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}

        {loading ? (
          <div className="space-y-3">
            <div className="h-24 animate-pulse rounded-3xl bg-neutral-100" />
            <div className="h-64 animate-pulse rounded-3xl bg-neutral-100" />
          </div>
        ) : (
          <>
            {/* การ์ดสถานะ */}
            {status === null && (
              <section aria-label="สถานะ" className="rounded-3xl border border-line bg-[#FFF4CC] p-5">
                <p className="flex items-center gap-2 text-sm font-bold text-black">
                  <ShieldCheck className="h-5 w-5" aria-hidden /> ยังไม่ได้ยืนยันตัวตน
                </p>
                <p className="mt-1 text-xs leading-relaxed text-neutral-700">
                  กรอกข้อมูลและส่งคำขอเพื่อรับการอนุมัติจากทีมงาน — จำเป็นก่อนรับบัญชีเงินรายได้
                </p>
              </section>
            )}
            {status === 'pending' && (
              <section aria-label="สถานะ" className="rounded-3xl border border-[#FFC400] bg-[#FFF4CC] p-5">
                <p className="flex items-center gap-2 text-sm font-bold text-black">
                  <Clock className="h-5 w-5" aria-hidden /> คำขอของคุณกำลังรอตรวจสอบ
                </p>
                <p className="mt-1 text-xs text-neutral-700">
                  ส่งเมื่อ{' '}
                  {data?.latest ? new Date(data.latest.created_at).toLocaleString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '-'}{' '}
                  — โปรดรอทีมงานตรวจ ไม่ต้องส่งซ้ำ
                </p>
              </section>
            )}
            {status === 'approved' && (
              <section aria-label="สถานะ" className="rounded-3xl border border-line bg-black p-5 text-white">
                <p className="flex items-center gap-2 text-sm font-bold text-[#FFC400]">
                  <BadgeCheck className="h-5 w-5" aria-hidden /> ยืนยันตัวตนเรียบร้อยแล้ว
                </p>
                <p className="mt-1 text-xs text-white/70">บัญชีธนาคารรับรายได้ของคุณพร้อมใช้งาน</p>
              </section>
            )}
            {status === 'rejected' && (
              <section aria-label="สถานะ" className="rounded-3xl border border-red-200 bg-red-50 p-5">
                <p className="flex items-center gap-2 text-sm font-bold text-red-700">
                  <TriangleAlert className="h-5 w-5" aria-hidden /> คำขอถูกปฏิเสธ
                </p>
                {data?.latest?.rejection_reason && (
                  <p className="mt-1 text-xs text-red-600">เหตุผล: {data.latest.rejection_reason}</p>
                )}
                <p className="mt-1 text-xs text-red-500">แก้ไขข้อมูลแล้วส่งคำขอใหม่ได้ด้านล่าง</p>
              </section>
            )}

            {/* ฟอร์ม */}
            {status !== 'pending' && (
              <section aria-label="แบบฟอร์มยืนยันตัวตน" className="space-y-3 rounded-3xl border border-line bg-white p-4">
                <label className="block space-y-1">
                  <span className="text-xs font-bold text-black">เลขใบอนุญาตขับขี่</span>
                  <input
                    value={license}
                    onChange={(e) => setLicense(e.target.value)}
                    maxLength={30}
                    data-testid="kyc-license"
                    placeholder="เช่น 11-2-1234567-8"
                    className="h-12 w-full rounded-2xl border border-line bg-white px-3 text-sm text-black placeholder:text-neutral-300"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-xs font-bold text-black">ทะเบียนรถ</span>
                  <input
                    value={plate}
                    onChange={(e) => setPlate(e.target.value)}
                    maxLength={30}
                    data-testid="kyc-plate"
                    placeholder="เช่น 1กก 1234"
                    className="h-12 w-full rounded-2xl border border-line bg-white px-3 text-sm text-black placeholder:text-neutral-300"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-xs font-bold text-black">ลิงก์รูปบัตรประชาชน (ถ้ามี)</span>
                  <input
                    value={idCardUrl}
                    onChange={(e) => setIdCardUrl(e.target.value)}
                    inputMode="url"
                    data-testid="kyc-idcard-url"
                    placeholder="https://..."
                    className="h-12 w-full rounded-2xl border border-line bg-white px-3 text-sm text-black placeholder:text-neutral-300"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-xs font-bold text-black">ลิงก์รูปใบอนุญาตขับขี่ (ถ้ามี)</span>
                  <input
                    value={licenseUrl}
                    onChange={(e) => setLicenseUrl(e.target.value)}
                    inputMode="url"
                    data-testid="kyc-license-url"
                    placeholder="https://..."
                    className="h-12 w-full rounded-2xl border border-line bg-white px-3 text-sm text-black placeholder:text-neutral-300"
                  />
                </label>
                <label className="flex items-start gap-2 rounded-2xl bg-neutral-50 px-3 py-3">
                  <input
                    type="checkbox"
                    checked={terms}
                    onChange={(e) => setTerms(e.target.checked)}
                    data-testid="kyc-terms"
                    className="mt-0.5 h-4 w-4 accent-black"
                  />
                  <span className="text-xs leading-relaxed text-neutral-700">
                    ข้าพเจ้ายอมรับข้อกำหนดและเงื่อนไขการเป็นไรเดอร์ฟู๊ด ธันเดอร์ รวมถึงความจริงของข้อมูลที่ส่งทั้งหมด
                  </span>
                </label>
                <button
                  type="button"
                  onClick={() => void submit()}
                  disabled={busy}
                  data-testid="kyc-submit"
                  className="btn-brand h-12 w-full text-sm disabled:opacity-50"
                >
                  {busy ? 'กำลังส่งคำขอ...' : 'ส่งคำขอยืนยันตัวตน'}
                </button>
              </section>
            )}
          </>
        )}
      </main>

      <footer className="mt-auto border-t border-line bg-white pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-4 text-center text-xs text-neutral-400">
        © {new Date().getFullYear()} ฟู๊ด ธันเดอร์ — พอร์ทัลไรเดอร์
      </footer>
    </div>
  );
}
