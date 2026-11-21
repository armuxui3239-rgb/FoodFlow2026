'use client';

import { useEffect, useState } from 'react';
import { Download, Share, X } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_KEY = 'ft_pwa_install_dismissed';

/** การ์ดชวนติดตั้งแอปลงมือถือและพีซี (รองรับทั้ง Android/PC Chrome-Edge และ iOS Safari) */
export function PwaInstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIos, setIsIos] = useState(false);
  const [installed, setInstalled] = useState(true);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      Boolean((window.navigator as { standalone?: boolean }).standalone);
    if (standalone) {
      setInstalled(true);
      return;
    }
    setInstalled(false);

    try {
      setDismissed(localStorage.getItem(DISMISS_KEY) === '1');
    } catch {
      setDismissed(false);
    }

    const ua = window.navigator.userAgent;
    const ios = /iPhone|iPad|iPod/i.test(ua) && !/CriOS|FxiOS/i.test(ua);
    setIsIos(ios);

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    const onAppInstalled = () => {
      setInstalled(true);
      setDeferredPrompt(null);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onAppInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onAppInstalled);
    };
  }, []);

  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* ignore */
    }
  };

  const install = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') setInstalled(true);
    setDeferredPrompt(null);
  };

  if (installed || dismissed || (!deferredPrompt && !isIos)) return null;

  return (
    <section
      aria-label="ติดตั้งแอปพลิเคชัน"
      className="flex items-center gap-3 rounded-3xl border border-line bg-[#FFF4CC]/60 p-4"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-black text-[#FFC400]">
        {deferredPrompt ? <Download className="h-5 w-5" aria-hidden /> : <Share className="h-5 w-5" aria-hidden />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-black">ติดตั้งแอป ฟู๊ด ธันเดอร์</p>
        <p className="text-xs text-neutral-600">
          {deferredPrompt
            ? 'เพิ่มลงหน้าจอหลักมือถือหรือพีซีเพื่อเปิดใช้งานได้ทันที'
            : 'บน iOS: แตะปุ่มแชร์ (Share) ด้านล่าง แล้วเลือก “เพิ่มไปยังหน้าจอโฮม”'}
        </p>
      </div>
      {deferredPrompt && (
        <button
          type="button"
          onClick={() => void install()}
          className="btn-brand h-9 shrink-0 px-4 text-xs"
        >
          ติดตั้ง
        </button>
      )}
      <button
        type="button"
        onClick={dismiss}
        aria-label="ปิดคำแนะนำการติดตั้ง"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-neutral-400 hover:bg-white hover:text-black"
      >
        <X className="h-4 w-4" aria-hidden />
      </button>
    </section>
  );
}
