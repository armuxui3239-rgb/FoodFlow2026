'use client';

import Link from 'next/link';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { ArrowLeft, CircleCheck, Info, Languages } from 'lucide-react';

/**
 * หน้าเลือกภาษา — ตามต้นแบบ Language
 * หมายเหตุ: i18n เต็มรูปแบบ (ไฟล์แปล en.json + next-intl) จะทำในรอบถัดไป
 * ขณะนี้เก็บค่าที่ผู้ใช้เลือกไว้ใน localStorage (key: 'ft_locale') แล้วแจ้งในหน้าว่าการแปลยังอยู่ระหว่างพัฒนา
 */

type Locale = 'th' | 'en';

const LOCALE_KEY = 'ft_locale';

interface LanguageOption {
  key: Locale;
  label: string;
  sub: string;
}

const RECOMMENDED: LanguageOption[] = [{ key: 'th', label: 'ภาษาไทย', sub: 'ไทย' }];

const OTHERS: LanguageOption[] = [{ key: 'en', label: 'อังกฤษ', sub: 'English (US)' }];

/* --- คลัง locale ขนาดจิ๋ว: localStorage เป็น external store (กัน hydration mismatch) --- */
const localeListeners = new Set<() => void>();

function subscribeLocale(callback: () => void): () => void {
  localeListeners.add(callback);
  window.addEventListener('storage', callback);
  return () => {
    localeListeners.delete(callback);
    window.removeEventListener('storage', callback);
  };
}

function getLocaleSnapshot(): Locale {
  return window.localStorage.getItem(LOCALE_KEY) === 'en' ? 'en' : 'th';
}

function getLocaleServerSnapshot(): Locale {
  return 'th';
}

function saveLocale(next: Locale): void {
  try {
    window.localStorage.setItem(LOCALE_KEY, next);
  } catch {
    // บันทึก localStorage ไม่ได้ (โหมดส่วนตัว) — ยังเลือกได้ในเซสชันนี้
  }
  localeListeners.forEach((listener) => listener());
}

export default function LanguagePage() {
  // สถานะ loading — แสดงโครงร่างสั้น ๆ ระหว่างไฮเดรตก่อนอ่านค่าจริง
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    // ตั้งค่าผ่าน callback ของ timer (ไม่ใช่ setState พร้อมกันใน effect)
    const timer = setTimeout(() => setHydrated(true), 0);
    return () => clearTimeout(timer);
  }, []);

  const locale = useSyncExternalStore(subscribeLocale, getLocaleSnapshot, getLocaleServerSnapshot);

  if (!hydrated) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="กำลังโหลดการตั้งค่าภาษา">
        <div className="h-10 w-10 animate-pulse rounded-full bg-neutral-100" />
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="h-16 animate-pulse rounded-2xl bg-neutral-100" />
        ))}
      </div>
    );
  }

  const row = (opt: LanguageOption, i: number, first: boolean) => (
    <button
      key={opt.key}
      type="button"
      data-testid={`lang-${opt.key}`}
      aria-pressed={locale === opt.key}
      onClick={() => saveLocale(opt.key)}
      className={`flex w-full items-center gap-3 px-4 py-4 text-left transition-colors hover:bg-[#FFF4CC]/50 ${
        i > 0 || !first ? 'border-t border-line' : ''
      }`}
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#FFF4CC]">
        <Languages className="h-4 w-4 text-black" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-black">{opt.label}</span>
        <span className="block truncate-1 text-xs text-neutral-400">{opt.sub}</span>
      </span>
      {locale === opt.key && <CircleCheck className="h-5 w-5 shrink-0 text-black" aria-hidden />}
    </button>
  );

  return (
    <div className="space-y-5">
      <header className="flex items-center gap-3 pt-1">
        <Link
          href="/profile"
          aria-label="ย้อนกลับไปหน้าโปรไฟล์"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-line bg-white transition-colors hover:bg-[#FFF4CC]"
        >
          <ArrowLeft className="h-4 w-4 text-black" aria-hidden />
        </Link>
        <h1 className="text-lg font-bold text-black">ภาษา</h1>
      </header>

      {locale === 'en' && (
        // แจ้งเตือนเมื่อเลือกภาษาอังกฤษ — การแปลยังไม่พร้อมใช้งาน
        <div
          role="status"
          data-testid="locale-en-notice"
          className="flex items-start gap-2 rounded-2xl bg-[#FFF4CC] px-4 py-3"
        >
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-black" aria-hidden />
          <p className="text-sm leading-relaxed text-neutral-700">
            การแปลภาษาอังกฤษอยู่ระหว่างพัฒนา — ขณะนี้รองรับภาษาไทยเต็มรูปแบบ
          </p>
        </div>
      )}

      <section aria-label="ภาษาแนะนำ" className="space-y-2">
        <h2 className="text-xs font-bold uppercase tracking-wide text-neutral-400">แนะนำ</h2>
        <div className="overflow-hidden rounded-3xl border border-line bg-white">
          {RECOMMENDED.map((opt, i) => row(opt, i, true))}
        </div>
      </section>

      <section aria-label="ภาษาอื่น" className="space-y-2">
        <h2 className="text-xs font-bold uppercase tracking-wide text-neutral-400">ภาษาอื่น</h2>
        <div className="overflow-hidden rounded-3xl border border-line bg-white">
          {OTHERS.map((opt, i) => row(opt, i, false))}
        </div>
      </section>
    </div>
  );
}
