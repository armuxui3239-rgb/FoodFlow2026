'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck, Info } from 'lucide-react';
import { AuthShell } from '@/components/auth-shell';

interface OtpFlow {
  otpId: string;
  phone: string;
  phoneMasked: string;
  deliveryChannel?: 'dev_console' | 'internal_code' | 'sms_gateway_selfhosted';
  devCode?: string;
  purpose: 'register' | 'reset_pin';
  resendInSec: number;
}

export default function VerifyOtpPage() {
  const router = useRouter();
  const [flow, setFlow] = useState<OtpFlow | null>(null);
  const [digits, setDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(55);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    const raw = sessionStorage.getItem('ft_otp_flow');
    if (!raw) {
      router.replace('/login');
      return;
    }
    const parsed = JSON.parse(raw) as OtpFlow;
    setFlow(parsed);
    setCooldown(parsed.resendInSec ?? 55);
    inputs.current[0]?.focus();
  }, [router]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  const setDigit = (i: number, v: string) => {
    const clean = v.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[i] = clean;
    setDigits(next);
    setError('');
    if (clean && i < 5) inputs.current[i + 1]?.focus();
  };

  const onKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[i] && i > 0) inputs.current[i - 1]?.focus();
  };

  const onPaste = (e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!text) return;
    e.preventDefault();
    const next = ['', '', '', '', '', ''].map((_, i) => text[i] ?? '');
    setDigits(next);
    inputs.current[Math.min(text.length, 5)]?.focus();
  };

  const submit = async (codeOverride?: string) => {
    if (!flow) return;
    const code = codeOverride ?? digits.join('');
    if (code.length !== 6) {
      setError('กรุณากรอกรหัสให้ครบ 6 หลัก');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ otpId: flow.otpId, code }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? 'ตรวจสอบไม่สำเร็จ');
      sessionStorage.removeItem('ft_otp_flow');
      router.push(flow.purpose === 'register' ? '/onboarding/profile' : '/onboarding/pin?flow=reset');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ตรวจสอบไม่สำเร็จ');
      setDigits(['', '', '', '', '', '']);
      inputs.current[0]?.focus();
      setLoading(false);
    }
  };

  const resend = async () => {
    if (!flow || cooldown > 0) return;
    setError('');
    try {
      const res = await fetch('/api/auth/otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: flow.phone, purpose: flow.purpose }),
      });
      const body = await res.json();
      if (!res.ok) {
        if (body.resendInSec) setCooldown(body.resendInSec);
        throw new Error(body.error ?? 'ส่งรหัสใหม่ไม่สำเร็จ');
      }
      const updated: OtpFlow = {
        ...flow,
        otpId: body.otpId,
        devCode: body.devCode,
        deliveryChannel: body.deliveryChannel,
      };
      setFlow(updated);
      sessionStorage.setItem('ft_otp_flow', JSON.stringify(updated));
      setCooldown(body.resendInSec ?? 55);
      setDigits(['', '', '', '', '', '']);
      inputs.current[0]?.focus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ส่งรหัสใหม่ไม่สำเร็จ');
    }
  };

  if (!flow) {
    return (
      <AuthShell title="ยืนยันรหัส OTP" backHref="/login">
        <p className="text-center text-sm text-ink-soft">กำลังโหลด...</p>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="ยืนยันรหัส OTP" backHref={flow.purpose === 'register' ? '/register' : '/forgot-pin'}>
      <div className="mb-5 flex flex-col items-center gap-2">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#FFF4CC]">
          <ShieldCheck className="h-7 w-7 text-black" aria-hidden />
        </span>
        <p className="text-sm text-ink-soft">
          ระบบส่งรหัสไปที่ <span className="font-bold text-ink">{flow.phoneMasked}</span>
        </p>
      </div>

      {/* แจ้งช่องทางรับรหัส — internal_code แสดงรหัสในระบบทันที (นโยบายจบในระบบ ไม่มีการส่ง SMS) */}
      {(flow.deliveryChannel === 'dev_console' || flow.deliveryChannel === 'internal_code') && flow.devCode ? (
        <button
          type="button"
          onClick={() => {
            setDigits(['', '', '', '', '', ''].map((_, i) => flow.devCode?.[i] ?? ''));
            inputs.current[5]?.focus();
          }}
          className="mb-5 flex w-full items-start gap-2 rounded-2xl bg-[#FFF4CC] px-4 py-3 text-start text-sm text-ink"
        >
          <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>
            รหัสยืนยันภายในระบบของคุณ:{' '}
            <span className="font-bold tracking-[0.3em]">{flow.devCode}</span>
            <span className="block text-xs text-ink-soft">กดเพื่อกรอกโค้ดอัตโนมัติ (ระบบไม่ส่ง SMS — แสดงในแอปเท่านั้น)</span>
          </span>
        </button>
      ) : (
        <div className="mb-5 flex items-start gap-2 rounded-2xl bg-[#FFF4CC] px-4 py-3 text-sm text-ink">
          <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>
            ระบบสร้างรหัสยืนยัน 6 หลักแล้ว — กรอกรหัสที่ได้รับ (หมดอายุ 5 นาที)
          </span>
        </div>
      )}

      {error && (
        <p role="alert" className="mb-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </p>
      )}

      <div className="mb-5 flex justify-center gap-2 sm:gap-3" onPaste={onPaste}>
        {digits.map((d, i) => (
          <input
            key={i}
            ref={(el) => {
              inputs.current[i] = el;
            }}
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={d}
            onChange={(e) => setDigit(i, e.target.value)}
            onKeyDown={(e) => onKeyDown(i, e)}
            maxLength={1}
            aria-label={`หลักที่ ${i + 1}`}
            className="h-13 w-10 rounded-2xl border border-line bg-neutral-50 text-center text-lg font-bold text-ink outline-none focus:border-brand focus:bg-white sm:h-14 sm:w-12 sm:text-xl"
          />
        ))}
      </div>

      <p className="mb-5 text-center text-sm text-ink-soft">
        {cooldown > 0 ? (
          <>ส่งซ้ำได้ใน <span className="font-bold text-ink">{cooldown}</span> วินาที</>
        ) : (
          <button type="button" onClick={resend} className="font-bold text-ink hover:underline">
            ส่งรหัสซ้ำ
          </button>
        )}
      </p>

      <button
        type="button"
        onClick={() => submit()}
        disabled={loading || digits.join('').length !== 6}
        className="w-full rounded-full bg-brand py-3.5 text-sm font-bold text-black transition hover:bg-brand-strong disabled:opacity-60"
      >
        {loading ? 'กำลังตรวจสอบ...' : 'ยืนยัน'}
      </button>
    </AuthShell>
  );
}
