'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import {
  ArrowLeft,
  Bell,
  Bike,
  History,
  LogOut,
  Landmark,
  LifeBuoy,
  Settings as SettingsIcon,
  ShieldCheck,
  Star,
  Target,
  UserRound,
  Wallet,
} from 'lucide-react';
import { api, useSession } from '@/lib/client';

/** เมนูนำทางของพอร์ทัลไรเดอร์ — ครบทุกหน้าตามโครงสร้างระบบ */
const NAV: { href: string; label: string; Icon: typeof Bike }[] = [
  { href: '/driver', label: 'งานของฉัน', Icon: Bike },
  { href: '/driver/history', label: 'ประวัติ', Icon: History },
  { href: '/driver/earnings', label: 'รายได้', Icon: Wallet },
  { href: '/driver/profile', label: 'โปรไฟล์', Icon: UserRound },
  { href: '/driver/bank', label: 'บัญชีธนาคาร', Icon: Landmark },
  { href: '/driver/kyc', label: 'ยืนยันตัวตน', Icon: ShieldCheck },
  { href: '/driver/incentives', label: 'แคมเปญ', Icon: Target },
  { href: '/driver/ratings', label: 'คะแนน', Icon: Star },
  { href: '/driver/notifications', label: 'แจ้งเตือน', Icon: Bell },
  { href: '/driver/support', label: 'ช่วยเหลือ', Icon: LifeBuoy },
  { href: '/driver/settings', label: 'ตั้งค่า', Icon: SettingsIcon },
];

/** แถบหลักพอร์ทัลไรเดอร์ — โลโก้ + ชื่อไรเดอร์ + เมนูยาเลื่อนแนวนอน + ปุ่มออกจากระบบ */
export function DriverHeader() {
  const { user, logout } = useSession();
  const pathname = usePathname();
  const [name, setName] = useState('');

  useEffect(() => {
    api<{ fullName: string }>('/api/driver/me')
      .then((m) => setName(m.fullName))
      .catch(() => setName(''));
  }, []);

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-white/95 backdrop-blur">
      <div className="mx-auto w-full max-w-5xl px-4">
        <div className="flex h-14 items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#FFC400] text-black">
              <Bike className="h-5 w-5" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="truncate-1 text-sm font-bold text-black">{name || 'พอร์ทัลไรเดอร์'}</p>
              <p className="text-[11px] text-neutral-400">มุมมองไรเดอร์{user ? ` · ${user.fullName}` : ''}</p>
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
        <nav aria-label="เมนูพอร์ทัลไรเดอร์" className="flex gap-1.5 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {NAV.map(({ href, label, Icon }) => {
            const active = href === '/driver' ? pathname === '/driver' : pathname.startsWith(href);
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
export function DriverSubHeader({
  title,
  subtitle,
  backHref = '/driver',
  Icon = Bike,
  right,
}: {
  title: string;
  subtitle?: string;
  backHref?: string;
  Icon?: typeof Bike;
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

/** ท้ายหน้าของพอร์ทัลไรเดอร์ — เหนียวล่างเมื่อเนื้อหาสั้น */
export function DriverFooter() {
  return (
    <footer className="mt-auto border-t border-line bg-white pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-4 text-center text-xs text-neutral-400">
      © {new Date().getFullYear()} ฟู๊ด ธันเดอร์ — พอร์ทัลไรเดอร์
    </footer>
  );
}

/** โครงหน้าย่อยทั่วไป: SubHeader + main + footer */
export function DriverSubShell({
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
  Icon?: typeof Bike;
  right?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <DriverSubHeader title={title} subtitle={subtitle} backHref={backHref} Icon={Icon} right={right} />
      <main className="mx-auto w-full max-w-5xl flex-1 space-y-6 px-4 py-5">{children}</main>
      <DriverFooter />
    </div>
  );
}
