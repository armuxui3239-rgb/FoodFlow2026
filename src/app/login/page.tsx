'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Zap, Smartphone, KeyRound, Eye, EyeOff, Mail, Lock } from 'lucide-react';

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get('next') || '/';

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
      if (!res.ok) throw new Error(body.error ?? 'เข้าสู่ระบบไม่สำเร็จ');
      router.push(roleHome(body.user?.role, next));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'เข้าสู่ระบบไม่สำเร็จ');
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
      if (!res.ok) throw new Error(body.error ?? 'เข้าสู่ระบบไม่สำเร็จ');
      router.push(roleHome(body.user?.role, next));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'เข้าสู่ระบบไม่สำเร็จ');
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <main className="flex flex-1 flex-col items-center justify-center px-5 py-10">
        <div className="mb-8 flex flex-col items-center gap-2">
          <span className="flex h-16 w-16 items-center justify-center rounded-3xl bg-brand">
            <Zap className="h-8 w-8 text-black" aria-hidden />
          </span>
          <h1 className="text-2xl font-bold text-ink">ฟู๊ด ธันเดอร์</h1>
          <p className="text-sm text-ink-soft">สั่งอาหาร ส่งไว ถึงบ้าน</p>
        </div>

        <div className="w-full max-w-sm rounded-3xl border border-line bg-white p-6 shadow-sm">
          <h2 className="mb-1 text-lg font-bold text-ink">เข้าสู่ระบบ</h2>
          <p className="mb-5 text-sm text-ink-soft">
            {mode === 'pin' ? 'ใช้เบอร์โทรและ PIN 6 หลักของคุณ' : 'สำหรับบัญชีที่สมัครด้วยอีเมล'}
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
                  aria-label="เบอร์โทรศัพท์"
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
                  placeholder="PIN 6 หลัก"
                  autoComplete="current-password"
                  className="w-full bg-transparent text-sm tracking-[0.3em] text-ink outline-none placeholder:text-neutral-400 placeholder:tracking-normal"
                  aria-label="PIN 6 หลัก"
                  required
                />
                <button
                  type="button"
                  aria-label={showPin ? 'ซ่อน PIN' : 'แสดง PIN'}
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
                จำฉันไว้ในอุปกรณ์นี้
              </label>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-full bg-brand py-3.5 text-sm font-bold text-black transition hover:bg-brand-strong disabled:opacity-60"
              >
                {loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
              </button>

              <p className="text-center">
                <Link href="/forgot-pin" className="text-sm font-medium text-ink-soft hover:text-ink hover:underline">
                  ลืม PIN?
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
                  placeholder="อีเมล"
                  autoComplete="email"
                  className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-neutral-400"
                  aria-label="อีเมล"
                  required
                />
              </label>
              <label className="flex items-center gap-3 rounded-2xl border border-line bg-neutral-50 px-4 py-3.5 focus-within:border-brand">
                <Lock className="h-5 w-5 shrink-0 text-ink-soft" aria-hidden />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="รหัสผ่าน"
                  autoComplete="current-password"
                  className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-neutral-400"
                  aria-label="รหัสผ่าน"
                  required
                />
              </label>
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-full bg-brand py-3.5 text-sm font-bold text-black transition hover:bg-brand-strong disabled:opacity-60"
              >
                {loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบด้วยอีเมล'}
              </button>
            </form>
          )}

          <div className="my-5 flex items-center gap-3">
            <span className="h-px flex-1 bg-line" />
            <span className="text-xs text-ink-soft">หรือ</span>
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
            {mode === 'pin' ? 'เข้าสู่ระบบด้วยอีเมล (บัญชีเดิม)' : 'เข้าสู่ระบบด้วยเบอร์โทร + PIN'}
          </button>
        </div>

        <p className="mt-6 text-sm text-ink-soft">
          ยังไม่มีบัญชี?{' '}
          <Link href="/register" className="font-bold text-ink hover:underline">
            สมัครสมาชิก
          </Link>
        </p>
      </main>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={<div className="flex min-h-screen items-center justify-center bg-white text-sm text-ink-soft">กำลังโหลด...</div>}
    >
      <LoginForm />
    </Suspense>
  );
}
