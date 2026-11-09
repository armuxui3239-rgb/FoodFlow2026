'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Delete, ShieldCheck } from 'lucide-react';
import { AuthShell } from '@/components/auth-shell';

function CreatePinInner() {
  const router = useRouter();
  const params = useSearchParams();
  const isReset = params.get('flow') === 'reset';
  const backHref = isReset ? '/forgot-pin' : '/onboarding/location';
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const submitting = useRef(false);

  const submitPin = useCallback(
    async (code: string) => {
      if (submitting.current) return;
      submitting.current = true;
      setLoading(true);
      setError('');
      try {
        const res = await fetch('/api/auth/onboard/pin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pin: code }),
        });
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? 'ตั้ง PIN ไม่สำเร็จ');
        router.push(isReset ? '/' : body.next ?? '/onboarding/biometric');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'ตั้ง PIN ไม่สำเร็จ');
        setPin('');
        setLoading(false);
        submitting.current = false;
      }
    },
    [router],
  );

  const press = (d: string) => {
    if (loading) return;
    setError('');
    setPin((p) => {
      if (p.length >= 6) return p;
      const next = p + d;
      if (next.length === 6) void submitPin(next);
      return next;
    });
  };

  const backspace = () => setPin((p) => p.slice(0, -1));

  const onKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === 'Backspace') backspace();
    },
    // press/backspace ใช้ functional setState จึงปลอดภัยต่อ stale closure
    [loading],
  );

  useEffect(() => {
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onKeyDown]);

  return (
    <AuthShell title="ตั้ง PIN ใหม่" backHref={backHref}>
      <div className="mb-2 flex flex-col items-center gap-2">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#FFF4CC]">
          <ShieldCheck className="h-7 w-7 text-black" aria-hidden />
        </span>
        <p className="text-center text-sm text-ink-soft">
          ตั้ง PIN 6 หลักเพื่อความปลอดภัยของบัญชี และใช้เข้าสู่ระบบครั้งถัดไป
        </p>
      </div>

      {error && (
        <p role="alert" className="mb-4 rounded-2xl bg-red-50 px-4 py-3 text-center text-sm text-red-600">
          {error}
        </p>
      )}

      {/* ช่อง PIN 6 หลัก */}
      <div className="mb-8 flex justify-center gap-2 sm:gap-4" aria-label="PIN" role="group">
        {Array.from({ length: 6 }).map((_, i) => (
          <span
            key={i}
            aria-hidden
            className={`h-12 w-9 rounded-2xl border sm:h-14 sm:w-12 ${
              loading
                ? 'border-brand bg-[#FFF4CC]'
                : pin.length > i
                  ? 'border-black bg-black'
                  : 'border-line bg-neutral-50'
            } transition-colors`}
          >
            {pin.length > i && !loading && (
              <span className="flex h-full w-full items-center justify-center">
                <span className="h-3.5 w-3.5 rounded-full bg-white" />
              </span>
            )}
          </span>
        ))}
        <span className="sr-only" aria-live="polite">
          กรอกแล้ว {pin.length} จาก 6 หลัก
        </span>
      </div>

      {/* แป้นตัวเลข */}
      <div className="mx-auto grid max-w-xs grid-cols-3 gap-2" aria-label="แป้นพิมพ์ตัวเลข">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => press(d)}
            disabled={loading}
            className="h-14 rounded-2xl text-xl font-bold text-ink transition hover:bg-neutral-100 active:scale-95 disabled:opacity-50"
          >
            {d}
          </button>
        ))}
        <span aria-hidden />
        <button
          type="button"
          onClick={() => press('0')}
          disabled={loading}
          className="h-14 rounded-2xl text-xl font-bold text-ink transition hover:bg-neutral-100 active:scale-95 disabled:opacity-50"
        >
          0
        </button>
        <button
          type="button"
          onClick={backspace}
          disabled={loading}
          aria-label="ลบตัวเลข"
          className="flex h-14 items-center justify-center rounded-2xl text-ink transition hover:bg-neutral-100 active:scale-95 disabled:opacity-50"
        >
          <Delete className="h-6 w-6" aria-hidden />
        </button>
      </div>

      {loading && <p className="mt-4 text-center text-sm text-ink-soft">กำลังตั้ง PIN...</p>}
    </AuthShell>
  );
}

export default function CreatePinPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-white text-sm text-ink-soft">
          กำลังโหลด...
        </div>
      }
    >
      <CreatePinInner />
    </Suspense>
  );
}
