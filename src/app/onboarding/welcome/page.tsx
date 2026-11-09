'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PartyPopper } from 'lucide-react';
import { AuthShell } from '@/components/auth-shell';

export default function WelcomePage() {
  const router = useRouter();
  const [seconds, setSeconds] = useState(3);

  useEffect(() => {
    const t = setInterval(() => setSeconds((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (seconds === 0) {
      router.replace('/');
      router.refresh();
    }
  }, [seconds, router]);

  return (
    <AuthShell centered>
      <div className="flex flex-col items-center gap-4 text-center">
        <span className="flex h-24 w-24 items-center justify-center rounded-full bg-brand">
          <PartyPopper className="h-12 w-12 text-black" aria-hidden />
        </span>
        <h2 className="text-xl font-bold text-ink">ยินดีด้วย! บัญชีของคุณพร้อมใช้งาน</h2>
        <p className="max-w-xs text-sm text-ink-soft">
          คุณจะถูกพาไปยังหน้าแรกภายใน {seconds} วินาที
        </p>
        <button
          type="button"
          onClick={() => {
            router.replace('/');
            router.refresh();
          }}
          className="mt-2 rounded-full bg-brand px-8 py-3.5 text-sm font-bold text-black transition hover:bg-brand-strong"
        >
          เริ่มสั่งอาหารเลย
        </button>
      </div>
    </AuthShell>
  );
}
