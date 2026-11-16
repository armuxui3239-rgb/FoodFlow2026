'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { Home, LogOut, MessageCircle, ReceiptText, ShoppingBag, User } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCart, useSession } from '@/lib/client';
import { BrandLogo } from '@/components/brand-logo';
import { ThemeToggle } from '@/components/theme-toggle';
import { LocaleToggle } from '@/components/locale-toggle';

const TABS = [
  { href: '/', labelKey: 'home', icon: Home },
  { href: '/messages', labelKey: 'messages', icon: MessageCircle },
  { href: '/orders', labelKey: 'orders', icon: ReceiptText },
  { href: '/cart', labelKey: 'cart', icon: ShoppingBag },
  { href: '/profile', labelKey: 'profile', icon: User },
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { refresh: refreshSession } = useSession();
  const { count, refresh } = useCart();
  const t = useTranslations('nav');
  const tCommon = useTranslations('common');

  useEffect(() => {
    void refreshSession();
    void refresh();
     
  }, [pathname]);

  const AUTH_PREFIXES = ['/login', '/register', '/verify-otp', '/forgot-pin', '/onboarding'];
  // portal ของร้านค้า/ไรเดอร์/แอดมิน มี chrome ของตัวเอง (หัวเรื่อง+เมนูย่อยของ portal)
  const PORTAL_PREFIXES = ['/owner', '/driver', '/admin'];
  const hideChrome =
    AUTH_PREFIXES.some((p) => pathname.startsWith(p)) ||
    PORTAL_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  if (hideChrome) return <>{children}</>;

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <header className="sticky top-0 z-40 border-b border-line bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-2 px-3 sm:px-4">
          <Link href="/" className="flex min-w-0 items-center gap-2" aria-label="ฟู๊ด ธันเดอร์ หน้าแรก">
            <BrandLogo />
            <span className="hidden truncate-1 text-lg font-bold text-black sm:inline">ฟู๊ด ธันเดอร์</span>
          </Link>
          <div className="flex shrink-0 items-center gap-1 sm:gap-2">
            <Link
              href="/cart"
              aria-label={`ตะกร้า ${count} รายการ`}
              className="relative flex h-11 w-11 items-center justify-center rounded-full hover:bg-neutral-100"
            >
              <ShoppingBag className="h-5 w-5 text-black" aria-hidden />
              {count > 0 && (
                <span className="absolute right-1 top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-black px-1 text-[10px] font-bold text-[#FFC400]">
                  {count > 99 ? '99+' : count}
                </span>
              )}
            </Link>
            <LocaleToggle />
            <ThemeToggle />
            <HeaderUser />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-28 pt-4">{children}</main>

      <footer className="mt-auto border-t border-line bg-white pb-[calc(env(safe-area-inset-bottom)+5.5rem)] pt-4 text-center text-xs text-neutral-400">
        © {new Date().getFullYear()} ฟู๊ด ธันเดอร์ — สั่งอาหาร ส่งไว ถึงบ้าน
      </footer>

      <nav
        aria-label="เมนูหลัก"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
      >
        <div className="mx-auto grid max-w-5xl grid-cols-5">
          {TABS.map(({ href, labelKey, icon: Icon }) => {
            const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className="relative flex min-h-[3.5rem] flex-col items-center justify-center gap-0.5 py-2"
                aria-current={active ? 'page' : undefined}
              >
                <Icon
                  className={`h-5 w-5 ${active ? 'text-black' : 'text-neutral-400'}`}
                  aria-hidden
                />
                <span
                  className={`max-w-full truncate-1 px-0.5 text-[11px] font-medium ${active ? 'text-black' : 'text-neutral-400'}`}
                >
                  {t(labelKey)}
                </span>
                {active && <span className="absolute top-0 h-0.5 w-8 rounded-full bg-[#FFC400]" />}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

function HeaderUser() {
  const { user, ready, logout } = useSession();
  const tCommon = useTranslations('common');
  if (!ready) return <span className="h-11 w-20 animate-pulse rounded-full bg-neutral-100" />;
  if (!user) {
    return (
      <Link href="/login" className="btn-brand flex h-11 items-center px-4 text-sm">
        {tCommon('login')}
      </Link>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <span className="hidden truncate-1 max-w-32 text-sm font-medium text-black sm:block">
        {user.fullName || user.email}
      </span>
      <button
        onClick={() => void logout()}
        aria-label={tCommon('logout')}
        title={tCommon('logout')}
        className="flex h-10 shrink-0 items-center justify-center whitespace-nowrap rounded-full border border-neutral-200 px-2.5 text-sm text-neutral-600 hover:bg-neutral-50 sm:h-11 sm:px-3"
      >
        <LogOut className="h-4 w-4 sm:hidden" aria-hidden />
        <span className="hidden sm:inline">{tCommon('logout')}</span>
      </button>
    </div>
  );
}
