'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Smartphone, KeyRound, Eye, EyeOff, Mail, Lock } from 'lucide-react';
import { BrandLogo } from '@/components/brand-logo';
import { ThemeToggle } from '@/components/theme-toggle';
import { LocaleToggle } from '@/components/locale-toggle';

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get('next') || '/';
  const t = useTranslations('login');
  const tCommon = useTranslations('common');

  /** บทบาทร้านค้า/ไรเดอร์/แอดมินเข้า portal ของตัวเองเสมอ — ลูกค้าไปหน้าที่ตั้งใจไว้ */
  const roleHome = (role?: string) =>
    role === 'restaurant' ? '/owner' : role === 'driver' ? '/driver' : role === 'admin' ? '/admin' : next;
  const [mode, setMode] = useState<'pin' | 'email'>('pin');

  // PIN mode
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [remember, setRemember] = useState(true);

  // Email mode (บัญชีเดิม)
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submitPin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/login-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, pin, remember }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? t('failed'));
      router.push(next || roleHome(body.user?.role));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('failed'));
      setLoading(false);
    }
  };

  const submitEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? t('failed'));
      router.push(next || roleHome(body.user?.role));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('failed'));
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col bg-white">
      {/* มุมสลับภาษา/ธีม — หน้า auth ไม่มี header หลัก */}
      <div className="absolute right-3 top-3 z-10 flex items-center gap-1">
        <LocaleToggle />
        <ThemeToggle />
      </div>
      <main className="flex flex-1 flex-col items-center justify-center px-5 py-10">
        <div className="mb-8 flex flex-col items-center gap-2">
          <BrandLogo className="h-16 w-16 rounded-3xl" />
          <h1 className="text-2xl font-bold text-ink">ฟู๊ด ธันเดอร์</h1>
          <p className="text-sm text-ink-soft">{tCommon('brandTagline')}</p>
        </div>

        <div className="w-full max-w-sm rounded-3xl border border-line bg-white p-6 shadow-sm">
          <h2 className="mb-1 text-lg font-bold text-ink">{t('title')}</h2>
          <p className="mb-5 text-sm text-ink-soft">
            {mode === 'pin' ? t('subtitlePin') : t('subtitleEmail')}
          </p>

          {error && (
            <p role="alert" className="mb-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
            </p>
          )}

          {mode === 'pin' ? (
            <form onSubmit={submitPin} className="space-y-4">
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
                  aria-label={t('phoneLabel')}
                  required
                />
              </label>

              <label className="flex items-center gap-3 rounded-2xl border border-line bg-neutral-50 px-4 py-3.5 focus-within:border-brand">
                <KeyRound className="h-5 w-5 shrink-0 text-ink-soft" aria-hidden />
                <input
                  type={showPin ? 'text' : 'password'}
                  inputMode="numeric"
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder={t('pinPlaceholder')}
                  autoComplete="current-password"
                  className="w-full bg-transparent text-sm tracking-[0.3em] text-ink outline-none placeholder:text-neutral-400 placeholder:tracking-normal"
                  aria-label={t('pinLabel')}
                  required
                />
                <button
                  type="button"
                  aria-label={showPin ? t('hidePin') : t('showPin')}
                  onClick={() => setShowPin((s) => !s)}
                  className="text-ink-soft hover:text-ink"
                >
                  {showPin ? <EyeOff className="h-5 w-5" aria-hidden /> : <Eye className="h-5 w-5" aria-hidden />}
                </button>
              </label>

              <label className="flex cursor-pointer items-center gap-2 text-sm text-ink-soft">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="h-4 w-4 accent-black"
                />
                {t('remember')}
              </label>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-full bg-brand py-3.5 text-sm font-bold text-black transition hover:bg-brand-strong disabled:opacity-60"
              >
                {loading ? t('submitting') : tCommon('login')}
              </button>

              <p className="text-center">
                <Link href="/forgot-pin" className="text-sm font-medium text-ink-soft hover:text-ink hover:underline">
                  {t('forgotPin')}
                </Link>
              </p>
            </form>
          ) : (
            <form onSubmit={submitEmail} className="space-y-4">
              <label className="flex items-center gap-3 rounded-2xl border border-line bg-neutral-50 px-4 py-3.5 focus-within:border-brand">
                <Mail className="h-5 w-5 shrink-0 text-ink-soft" aria-hidden />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t('emailPlaceholder')}
                  autoComplete="email"
                  className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-neutral-400"
                  aria-label={t('emailLabel')}
                  required
                />
              </label>
              <label className="flex items-center gap-3 rounded-2xl border border-line bg-neutral-50 px-4 py-3.5 focus-within:border-brand">
                <Lock className="h-5 w-5 shrink-0 text-ink-soft" aria-hidden />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t('passwordPlaceholder')}
                  autoComplete="current-password"
                  className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-neutral-400"
                  aria-label={t('passwordLabel')}
                  required
                />
              </label>
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-full bg-brand py-3.5 text-sm font-bold text-black transition hover:bg-brand-strong disabled:opacity-60"
              >
                {loading ? t('submitting') : t('emailSubmit')}
              </button>
            </form>
          )}

          <div className="my-5 flex items-center gap-3">
            <span className="h-px flex-1 bg-line" />
            <span className="text-xs text-ink-soft">{tCommon('or')}</span>
            <span className="h-px flex-1 bg-line" />
          </div>

          <button
            type="button"
            onClick={() => {
              setMode((m) => (m === 'pin' ? 'email' : 'pin'));
              setError('');
            }}
            className="w-full rounded-full border border-line py-3.5 text-sm font-bold text-ink transition hover:bg-neutral-50"
          >
            {mode === 'pin' ? t('switchToEmail') : t('switchToPin')}
          </button>
        </div>

        <p className="mt-6 text-sm text-ink-soft">
          {t('noAccount')}{' '}
          <Link href="/register" className="font-bold text-ink hover:underline">
            {t('register')}
          </Link>
        </p>
      </main>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={<div className="flex min-h-screen items-center justify-center bg-white text-sm text-ink-soft">Loading...</div>}
    >
      <LoginForm />
    </Suspense>
  );
}
