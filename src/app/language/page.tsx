'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { ArrowLeft, CircleCheck, Info, Languages } from 'lucide-react';

type Locale = 'th' | 'en';

interface LanguageOption {
  key: Locale;
  label: string;
  sub: string;
}

const RECOMMENDED: LanguageOption[] = [{ key: 'th', label: 'ภาษาไทย', sub: 'ไทย' }];
const OTHERS: LanguageOption[] = [{ key: 'en', label: 'English', sub: 'English (US)' }];

function persistLocale(next: Locale) {
  try {
    window.localStorage.setItem('ft_locale', next);
  } catch {
    // โหมดส่วนตัว
  }
  document.cookie = `ft_locale=${next}; path=/; max-age=31536000; samesite=lax`;
}

export default function LanguagePage() {
  const locale = useLocale() as Locale;
  const router = useRouter();
  const t = useTranslations('languagePage');

  const selectLocale = (next: Locale) => {
    persistLocale(next);
    router.refresh();
  };

  const row = (opt: LanguageOption, i: number, first: boolean) => (
    <button
      key={opt.key}
      type="button"
      data-testid={`lang-${opt.key}`}
      aria-pressed={locale === opt.key}
      onClick={() => selectLocale(opt.key)}
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
        <h1 className="text-lg font-bold text-black">{t('title')}</h1>
      </header>

      <div
        role="status"
        className="flex items-start gap-2 rounded-2xl bg-[#FFF4CC] px-4 py-3"
      >
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-black" aria-hidden />
        <p className="text-sm leading-relaxed text-neutral-700">{t('note')}</p>
      </div>

      <section aria-label={t('recommended')} className="space-y-2">
        <h2 className="text-xs font-bold uppercase tracking-wide text-neutral-400">{t('recommended')}</h2>
        <div className="overflow-hidden rounded-3xl border border-line bg-white">
          {RECOMMENDED.map((opt, i) => row(opt, i, true))}
        </div>
      </section>

      <section aria-label={t('others')} className="space-y-2">
        <h2 className="text-xs font-bold uppercase tracking-wide text-neutral-400">{t('others')}</h2>
        <div className="overflow-hidden rounded-3xl border border-line bg-white">
          {OTHERS.map((opt, i) => row(opt, i, false))}
        </div>
      </section>
    </div>
  );
}
