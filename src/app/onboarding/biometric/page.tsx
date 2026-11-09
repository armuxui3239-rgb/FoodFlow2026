'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Fingerprint, ScanFace } from 'lucide-react';
import { AuthShell } from '@/components/auth-shell';

export default function BiometricSetupPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const save = async (enabled: boolean) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/onboard/biometric', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? 'บันทึกไม่สำเร็จ');
      router.push(body.next ?? '/onboarding/welcome');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'บันทึกไม่สำเร็จ');
      setLoading(false);
    }
  };

  return (
    <AuthShell title="เปิดใช้ไบโอเมตริก">
      <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
        <span className="flex h-24 w-24 items-center justify-center rounded-full bg-[#FFF4CC]">
          <Fingerprint className="h-14 w-14 text-black" aria-hidden />
        </span>
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-neutral-100">
          <ScanFace className="h-9 w-9 text-ink-soft" aria-hidden />
        </span>
        <p className="max-w-xs text-sm text-ink-soft">
          เปิดใช้ลายนิ้วมือหรือใบหน้าเพื่อปลดล็อกแอปได้เร็วขึ้น
          (ทำงานบนอุปกรณ์ที่รองรับ และสามารถเปลี่ยนได้ภายหลังในหน้าความปลอดภัย)
        </p>
        {error && (
          <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </p>
        )}
      </div>

      <div className="mt-8 flex gap-3">
        <button
          type="button"
          onClick={() => save(false)}
          disabled={loading}
          className="flex-1 rounded-full border border-line py-3.5 text-sm font-bold text-ink transition hover:bg-neutral-50 disabled:opacity-60"
        >
          ข้าม
        </button>
        <button
          type="button"
          onClick={() => save(true)}
          disabled={loading}
          className="flex-1 rounded-full bg-brand py-3.5 text-sm font-bold text-black transition hover:bg-brand-strong disabled:opacity-60"
        >
          {loading ? 'กำลังบันทึก...' : 'เปิดใช้'}
        </button>
      </div>
    </AuthShell>
  );
}
