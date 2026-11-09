'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Smartphone, Mail, User, Phone } from 'lucide-react';
import { AuthShell } from '@/components/auth-shell';

export default function RegisterPage() {
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
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
        body: JSON.stringify({ phone, email, fullName, purpose: 'register' }),
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
          purpose: 'register',
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
    <AuthShell title="สมัครบัญชีใหม่" backHref="/login">
      <div className="mb-6 flex flex-col items-center gap-2">
        <span className="flex h-16 w-16 items-center justify-center rounded-3xl bg-brand">
          <Phone className="h-8 w-8 text-black" aria-hidden />
        </span>
        <p className="text-center text-sm text-ink-soft">
          ยืนยันเบอร์โทรด้วยรหัส OTP 6 หลัก ที่ส่งทาง SMS ถึงคุณ (หมดอายุ 5 นาที)
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

        <label className="flex items-center gap-3 rounded-2xl border border-line bg-neutral-50 px-4 py-3.5 focus-within:border-brand">
          <Mail className="h-5 w-5 shrink-0 text-ink-soft" aria-hidden />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="อีเมล"
            autoComplete="email"
            className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-neutral-400"
            aria-label="อีเมล"
            required
          />
        </label>

        <label className="flex items-center gap-3 rounded-2xl border border-line bg-neutral-50 px-4 py-3.5 focus-within:border-brand">
          <User className="h-5 w-5 shrink-0 text-ink-soft" aria-hidden />
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="ชื่อ-นามสกุล"
            autoComplete="name"
            className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-neutral-400"
            aria-label="ชื่อ-นามสกุล"
            required
          />
        </label>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-full bg-brand py-3.5 text-sm font-bold text-black transition hover:bg-brand-strong disabled:opacity-60"
        >
          {loading ? 'กำลังส่งรหัส...' : 'สมัครสมาชิก'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-ink-soft">
        มีบัญชีอยู่แล้ว?{' '}
        <Link href="/login" className="font-bold text-ink hover:underline">
          เข้าสู่ระบบ
        </Link>
      </p>
    </AuthShell>
  );
}
