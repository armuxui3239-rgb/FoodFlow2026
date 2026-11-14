'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { BadgeCheck, CircleAlert, KeyRound, Smartphone } from 'lucide-react';
import { AuthShell } from '@/components/auth-shell';

/** หน้ายืนยันเบอร์เพื่อขอรีเซ็ต PIN */
function ForgotPinForm() {
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, purpose: 'reset_pin' }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? 'ส่งรหัสไม่สำเร็จ');
      sessionStorage.setItem(
        'ft_otp_flow',
        JSON.stringify({
          otpId: body.otpId,
          phone,
          phoneMasked: body.phoneMasked,
          deliveryChannel: body.deliveryChannel,
          devCode: body.devCode,
          purpose: 'reset_pin',
          resendInSec: body.resendInSec,
        }),
      );
      router.push('/verify-otp');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ส่งรหัสไม่สำเร็จ');
      setLoading(false);
    }
  };

  return (
    <>
      <div className="mb-6 flex flex-col items-center gap-2">
        <span className="flex h-16 w-16 items-center justify-center rounded-3xl bg-brand">
          <KeyRound className="h-8 w-8 text-black" aria-hidden />
        </span>
        <p className="text-center text-sm text-ink-soft">
          กรอกเบอร์โทรเพื่อยืนยันตัวตนด้วย OTP — หลังยืนยัน ผู้ดูแลระบบจะตรวจคำขอก่อนให้ตั้ง PIN ใหม่
        </p>
      </div>

      <form onSubmit={submit} className="space-y-4">
        {error && (
          <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </p>
        )}
        <label className="flex items-center gap-3 rounded-2xl border border-line bg-neutral-50 px-4 py-3.5 focus-within:border-brand">
          <Smartphone className="h-5 w-5 shrink-0 text-ink-soft" aria-hidden />
          <span className="text-sm font-medium text-ink">+66</span>
          <input
            type="tel"
            inputMode="numeric"
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
            placeholder="812345678"
            autoComplete="tel"
            className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-neutral-400"
            aria-label="เบอร์โทรศัพท์"
            required
          />
        </label>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-full bg-brand py-3.5 text-sm font-bold text-black transition hover:bg-brand-strong disabled:opacity-60"
        >
          {loading ? 'กำลังส่งรหัส...' : 'ส่งรหัส OTP'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-ink-soft">
        ยังไม่มีบัญชี?{' '}
        <Link href="/register" className="font-bold text-ink hover:underline">
          สมัครสมาชิก
        </Link>
      </p>
    </>
  );
}

/** หน้ารออนุมัติ — ลูกค้ายืนยัน OTP แล้ว กำลังรอแอดมินอนุมัติคำขอรีเซ็ต PIN (v4 ข้อ 4.5) */
function ForgotPinAwaiting() {
  const router = useRouter();
  const [checking, setChecking] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [statusErr, setStatusErr] = useState('');

  const checkStatus = async () => {
    setChecking(true);
    setStatusErr('');
    setStatusMsg('');
    try {
      const res = await fetch('/api/auth/reset-pin/status');
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? 'ตรวจสอบสถานะไม่สำเร็จ');
      const st = body.data?.status;
      if (st === 'approved') {
        router.push('/onboarding/pin?flow=reset');
      } else if (st === 'rejected') {
        setStatusErr('คำขอถูกปฏิเสธ — กรุณาติดต่อฝ่ายบริการหรือส่งคำขอใหม่');
      } else {
        setStatusMsg('ยังรอผู้ดูแลอนุมัติอยู่ กรุณากดตรวจสอบอีกครั้งภายหลัง');
      }
    } catch (err) {
      setStatusErr(err instanceof Error ? err.message : 'ตรวจสอบสถานะไม่สำเร็จ');
    } finally {
      setChecking(false);
    }
  };

  return (
    <AuthShell title="ลืม PIN" backHref="/login">
      <section className="flex flex-col items-center gap-3 rounded-3xl border border-line bg-white p-6 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-3xl bg-[#FFF4CC]">
          <BadgeCheck className="h-8 w-8 text-[#FFC400]" aria-hidden />
        </span>
        <h2 className="text-lg font-bold text-black">ยืนยันตัวตนสำเร็จ — คำขอถึงผู้ดูแลระบบแล้ว</h2>
        <p className="text-sm leading-relaxed text-ink-soft">
          ผู้ดูแลระบบจะตรวจสอบคำขอของคุณ เมื่ออนุมัติแล้ว กดปุ่ม "ตรวจสอบสถานะคำขอ" ด้านล่าง
          เพื่อไปตั้ง PIN ใหม่
        </p>

        {statusMsg && (
          <p role="status" className="w-full rounded-2xl bg-[#FFF4CC] px-4 py-3 text-sm text-black">
            {statusMsg}
          </p>
        )}
        {statusErr && (
          <p role="alert" className="flex w-full items-start gap-2 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">
            <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            {statusErr}
          </p>
        )}

        <button
          type="button"
          onClick={() => void checkStatus()}
          disabled={checking}
          data-testid="reset-pin-check-status"
          className="btn-brand mt-1 h-12 w-full text-sm"
        >
          {checking ? 'กำลังตรวจสอบ…' : 'ตรวจสอบสถานะคำขอ'}
        </button>
        <p className="text-[11px] leading-relaxed text-neutral-400">
          คำขอมีอายุ 24 ชั่วโมง — หากหมดเวลา กรุณายืนยัน OTP ใหม่อีกครั้ง
        </p>
      </section>
    </AuthShell>
  );
}

function ForgotPinInner() {
  const searchParams = useSearchParams();
  if (searchParams.get('awaiting') === '1') return <ForgotPinAwaiting />;
  return <ForgotPinForm />;
}

export default function ForgotPinPage() {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-3xl bg-neutral-100" />}>
      <ForgotPinInner />
    </Suspense>
  );
}
