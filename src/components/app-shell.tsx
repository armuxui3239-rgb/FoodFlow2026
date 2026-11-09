'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { Home, ReceiptText, ShoppingBag, User, Zap } from 'lucide-react';
import { useCart, useSession } from '@/lib/client';

const TABS = [
  { href: '/', label: 'หน้าแรก', icon: Home },
  { href: '/orders', label: 'คำสั่งซื้อ', icon: ReceiptText },
  { href: '/cart', label: 'ตะกร้า', icon: ShoppingBag },
  { href: '/profile', label: 'โปรไฟล์', icon: User },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { refresh: refreshSession } = useSession();
  const { count, refresh } = useCart();

  useEffect(() => {
    void refreshSession();
    void refresh();
     
  }, [pathname]);

  const AUTH_PREFIXES = ['/login', '/register', '/verify-otp', '/forgot-pin', '/onboarding'];
  const hideChrome = AUTH_PREFIXES.some((p) => pathname.startsWith(p));
  if (hideChrome) return <>{children}</>;

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <header className="sticky top-0 z-40 border-b border-line bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2" aria-label="ฟู๊ด ธันเดอร์ หน้าแรก">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#FFC400] text-black">
              <Zap className="h-5 w-5" aria-hidden />
            </span>
            <span className="truncate-1 text-lg font-bold text-black">ฟู๊ด ธันเดอร์</span>
          </Link>
          <div className="flex items-center gap-2">
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
        <div className="mx-auto grid max-w-5xl grid-cols-4">
          {TABS.map(({ href, label, icon: Icon }) => {
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
                  className={`text-[11px] font-medium ${active ? 'text-black' : 'text-neutral-400'}`}
                >
                  {label}
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
  if (!ready) return <span className="h-11 w-20 animate-pulse rounded-full bg-neutral-100" />;
  if (!user) {
    return (
      <Link href="/login" className="btn-brand flex h-11 items-center px-4 text-sm">
        เข้าสู่ระบบ
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
        className="flex h-11 shrink-0 items-center whitespace-nowrap rounded-full border border-neutral-200 px-3 text-sm text-neutral-600 hover:bg-neutral-50"
      >
        ออกจากระบบ
      </button>
    </div>
  );
}
