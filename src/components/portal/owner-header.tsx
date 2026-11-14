'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import {
  ArrowLeft,
  Bell,
  ClipboardList,
  LogOut,
  Settings as SettingsIcon,
  Star,
  Store,
  TicketPercent,
  TrendingUp,
  Users,
  Utensils,
  Wallet,
} from 'lucide-react';
import { api, useSession } from '@/lib/client';
import { BrandLogo } from '@/components/brand-logo';

/** เมนูนำทางของพอร์ทัลร้านค้า — ครบทุกหน้าตาม docs/PAGE-MAP.md */
const NAV: { href: string; label: string; Icon: typeof Store }[] = [
  { href: '/owner', label: 'แดชบอร์ด', Icon: Store },
  { href: '/owner/orders', label: 'ออเดอร์', Icon: ClipboardList },
  { href: '/owner/menu', label: 'เมนู', Icon: Utensils },
  { href: '/owner/promotions', label: 'โปรโมชั่น', Icon: TicketPercent },
  { href: '/owner/reviews', label: 'รีวิว', Icon: Star },
  { href: '/owner/revenue', label: 'รายได้', Icon: Wallet },
  { href: '/owner/stats', label: 'สถิติ', Icon: TrendingUp },
  { href: '/owner/staff', label: 'พนักงาน', Icon: Users },
  { href: '/owner/notifications', label: 'แจ้งเตือน', Icon: Bell },
  { href: '/owner/settings', label: 'ตั้งค่า', Icon: SettingsIcon },
];

/** แถบหลักพอร์ทัลร้านค้า — โลโก้ + ชื่อร้าน + เมนูยาเลื่อนแนวนอน + ปุ่มออกจากระบบ */
export function OwnerHeader() {
  const { user, logout } = useSession();
  const pathname = usePathname();
  const [name, setName] = useState('');

  useEffect(() => {
    api<{ restaurant: { name: string } }>('/api/owner/me')
      .then((m) => setName(m.restaurant.name))
      .catch(() => setName(''));
  }, []);

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-white/95 backdrop-blur">
      <div className="mx-auto w-full max-w-5xl px-4">
        <div className="flex h-14 items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <BrandLogo />
            <div className="min-w-0">
              <p className="truncate-1 text-sm font-bold text-black">{name || 'พอร์ทัลร้านค้า'}</p>
              <p className="text-[11px] text-neutral-400">มุมมองเจ้าของร้าน{user ? ` · ${user.fullName}` : ''}</p>
            </div>
          </div>
          <button
            onClick={() => void logout()}
            aria-label="ออกจากระบบ"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full hover:bg-neutral-100"
          >
            <LogOut className="h-5 w-5 text-neutral-500" aria-hidden />
          </button>
        </div>
        <nav aria-label="เมนูพอร์ทัลร้านค้า" className="flex gap-1.5 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {NAV.map(({ href, label, Icon }) => {
            const active = href === '/owner' ? pathname === '/owner' : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? 'page' : undefined}
                className={`flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3 text-xs font-bold transition-colors ${
                  active ? 'bg-[#FFC400] text-black' : 'bg-[#FFF4CC] text-black hover:bg-[#FFC400]'
                }`}
              >
                <Icon className="h-4 w-4" aria-hidden /> {label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}

/** แถบหน้าย่อย — ลูกศรย้อนกลับ + ไอคอน + ชื่อหน้า + ช่องขวา (ปุ่มแอ็กชัน) */
export function OwnerSubHeader({
  title,
  subtitle,
  backHref = '/owner',
  Icon = Store,
  right,
}: {
  title: string;
  subtitle?: string;
  backHref?: string;
  Icon?: typeof Store;
  right?: ReactNode;
}) {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-2 px-4">
        <div className="flex min-w-0 items-center gap-2">
          <Link
            href={backHref}
            aria-label="ย้อนกลับ"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-neutral-100 transition-transform active:scale-95"
          >
            <ArrowLeft className="h-5 w-5" aria-hidden />
          </Link>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#FFC400] text-black">
            <Icon className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="truncate-1 text-sm font-bold text-black">{title}</p>
            {subtitle && <p className="truncate-1 text-[11px] text-neutral-400">{subtitle}</p>}
          </div>
        </div>
        {right}
      </div>
    </header>
  );
}

/** ท้ายหน้าของพอร์ทัลร้านค้า — เหนียวล่างเมื่อเนื้อหาสั้น */
export function OwnerFooter() {
  return (
    <footer className="mt-auto border-t border-line bg-white pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-4 text-center text-xs text-neutral-400">
      © {new Date().getFullYear()} ฟู๊ด ธันเดอร์ — พอร์ทัลร้านค้า
    </footer>
  );
}

/** โครงหน้าย่อยทั่วไป: SubHeader + main + footer */
export function OwnerSubShell({
  title,
  subtitle,
  backHref,
  Icon,
  right,
  children,
}: {
  title: string;
  subtitle?: string;
  backHref?: string;
  Icon?: typeof Store;
  right?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <OwnerSubHeader title={title} subtitle={subtitle} backHref={backHref} Icon={Icon} right={right} />
      <main className="mx-auto w-full max-w-5xl flex-1 space-y-6 px-4 py-5">{children}</main>
      <OwnerFooter />
    </div>
  );
}
