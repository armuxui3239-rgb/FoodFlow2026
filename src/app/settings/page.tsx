'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  Bell,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Languages,
  MapPin,
  ShieldCheck,
  UserCog,
  Wallet,
} from 'lucide-react';
import { api, useSession } from '@/lib/client';

/** หน้ารวมการตั้งค่า — ลิงก์เข้าทุกกลุ่มการตั้งค่าของบัญชี */
const GROUPS: { href: string; labelKey: string; descKey: string; Icon: typeof Bell; testid: string }[] = [
  { href: '/settings/notifications', labelKey: 'notifications', descKey: 'notificationsDesc', Icon: Bell, testid: 'settings-notifications' },
  { href: '/settings/security', labelKey: 'security', descKey: 'securityDesc', Icon: ShieldCheck, testid: 'settings-security' },
  { href: '/profile/edit', labelKey: 'profile', descKey: 'profileDesc', Icon: UserCog, testid: 'settings-profile' },
  { href: '/addresses', labelKey: 'addresses', descKey: 'addressesDesc', Icon: MapPin, testid: 'settings-addresses' },
  { href: '/wallet', labelKey: 'wallet', descKey: 'walletDesc', Icon: Wallet, testid: 'settings-wallet' },
  { href: '/language', labelKey: 'language', descKey: 'languageDesc', Icon: Languages, testid: 'settings-language' },
  { href: '/help', labelKey: 'help', descKey: 'helpDesc', Icon: CircleHelp, testid: 'settings-help' },
];

export default function SettingsPage() {
  const { user } = useSession();
  const t = useTranslations('settings');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // รอ session โหลดเพื่อแสดงชื่อบัญชีจริง
    const t = setTimeout(() => setLoading(false), 300);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="space-y-5">
      <header className="flex items-center gap-2 pt-1">
        <Link
          href="/profile"
          aria-label="ย้อนกลับ"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-neutral-100 transition-transform active:scale-95"
        >
          <ChevronLeft className="h-5 w-5" aria-hidden />
        </Link>
        <h1 className="text-lg font-bold text-black">{t('title')}</h1>
      </header>

      {user ? (
        <p className="text-xs text-neutral-500">
          {t('accountLabel')}: <span className="font-semibold text-black">{user.fullName}</span>
        </p>
      ) : loading ? (
        <div className="h-4 w-40 animate-pulse rounded-full bg-neutral-100" />
      ) : null}

      <ul className="overflow-hidden rounded-3xl border border-line bg-white shadow-sm" aria-label={t('title')}>
        {GROUPS.map((g, i) => (
          <li key={g.href} className={i > 0 ? 'border-t border-line' : ''}>
            <Link
              href={g.href}
              data-testid={g.testid}
              className="flex items-center gap-3 p-4 transition-colors hover:bg-[#FFF4CC] active:bg-[#FFF4CC]"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#FFF4CC]">
                <g.Icon className="h-5 w-5 text-black" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold text-black">{t(g.labelKey)}</span>
                <span className="block truncate-1 text-xs text-neutral-400">{t(g.descKey)}</span>
              </span>
              <ChevronRight className="h-5 w-5 shrink-0 text-neutral-300" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
