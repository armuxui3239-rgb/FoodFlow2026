'use client';

import { useState } from 'react';
import { Volume2, X } from 'lucide-react';
import { soundEngine } from '@/lib/sound/engine';
import { useSoundStore } from '@/lib/sound/store';

/**
 * แบนเนอร์ขอให้ผู้ใช้กดปลดล็อกเสียง (Browser Autoplay Policy)
 * แสดงเฉพาะเมื่อระบบพยายามเล่นเสียงแล้ว AudioContext ยังอยู่ในสถานะ suspended
 */
export function AudioUnlockBanner() {
  const needsUnlock = useSoundStore((s) => s.needsUnlock);
  const setNeedsUnlock = useSoundStore((s) => s.setNeedsUnlock);
  const [unlocking, setUnlocking] = useState(false);

  if (!needsUnlock) return null;

  const handleUnlock = async () => {
    setUnlocking(true);
    try {
      const ok = await soundEngine.unlock();
      if (ok) {
        void soundEngine.playPreset('ui-success');
      }
    } finally {
      setUnlocking(false);
    }
  };

  return (
    <div
      role="region"
      aria-label="ปลดล็อกเสียงแจ้งเตือน"
      aria-live="polite"
      className="fixed bottom-20 left-1/2 z-50 flex w-[calc(100%-1.5rem)] max-w-md -translate-x-1/2 items-center gap-3 rounded-2xl border border-black/10 bg-[#FFC400] px-4 py-3 text-black shadow-lg md:bottom-6"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-black text-[#FFC400]">
        <Volume2 className="h-4.5 w-4.5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-bold leading-snug">เบราว์เซอร์บล็อกเสียงแจ้งเตือนชั่วคราว</p>
        <p className="text-[11px] leading-snug text-black/75">กดเปิดเสียงเพื่อรับแจ้งเตือนออเดอร์แบบเรียลไทม์</p>
      </div>
      <button
        type="button"
        disabled={unlocking}
        onClick={() => void handleUnlock()}
        className="shrink-0 rounded-full bg-black px-3.5 py-2 text-xs font-bold text-[#FFC400] transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {unlocking ? 'กำลังเปิด...' : 'เปิดเสียง'}
      </button>
      <button
        type="button"
        aria-label="ปิดแบนเนอร์ปลดล็อกเสียง"
        onClick={() => setNeedsUnlock(false)}
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-black/70 hover:bg-black/10 hover:text-black"
      >
        <X className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
}
