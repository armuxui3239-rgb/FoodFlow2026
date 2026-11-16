'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { Languages } from 'lucide-react';

/** ปุ่มสลับภาษา th↔en — เก็บค่าใน cookie 'ft_locale' (ปี) แล้ว refresh ให้ layout อ่านใหม่
 *  ธีมสีอยู่ในท็อกเกิลของตัวเอง (theme-toggle) — สองอิสระต่อกัน */
export function LocaleToggle() {
  const locale = useLocale();
  const router = useRouter();
  const t = useTranslations('common');
  const next = locale === 'th' ? 'en' : 'th';

  const switchTo = () => {
    document.cookie = `ft_locale=${next}; path=/; max-age=31536000; samesite=lax`;
    router.refresh();
  };

  return (
    <button
      type="button"
      onClick={switchTo}
      aria-label={t('switchLanguage')}
      title={t('switchLanguage')}
      className="flex h-10 shrink-0 items-center gap-1 rounded-full px-2 hover:bg-neutral-100"
    >
      <Languages className="h-5 w-5 text-neutral-500" aria-hidden />
      <span className="text-[11px] font-bold text-neutral-600">{next.toUpperCase()}</span>
    </button>
  );
}
