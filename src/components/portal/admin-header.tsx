'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import {
  ArrowLeft,
  BarChart3,
  Bell,
  Bot,
  ClipboardList,
  Download,
  FileBarChart,
  KeyRound,
  LogOut,
  Settings as SettingsIcon,
  XCircle,
  Shield,
  Store,
  User,
  Users,
  Wallet,
  Bike,
} from 'lucide-react';
import { useSession } from '@/lib/client';
import { BrandLogo } from '@/components/brand-logo';

/** เมนูนำทางของศูนย์ควบคุมผู้ดูแลระบบ */
const NAV: { href: string; label: string; Icon: typeof Shield }[] = [
  { href: '/admin', label: 'ศูนย์ควบคุม', Icon: Shield },
  { href: '/admin/users', label: 'ผู้ใช้', Icon: Users },
  { href: '/admin/restaurants', label: 'ร้านค้า', Icon: Store },
  { href: '/admin/orders', label: 'ออเดอร์', Icon: ClipboardList },
  { href: '/admin/drivers', label: 'ไรเดอร์', Icon: Bike },
  { href: '/admin/promotions', label: 'โปรโมชั่น', Icon: Bell },
  { href: '/admin/topups', label: 'เติมเงิน', Icon: Wallet },
  { href: '/admin/pin-resets', label: 'รีเซ็ต PIN', Icon: KeyRound },
  { href: '/admin/cancel-reasons', label: 'เหตุผลยกเลิก', Icon: XCircle },
  { href: '/admin/reports', label: 'รายงาน', Icon: FileBarChart },
  { href: '/admin/analytics', label: 'วิเคราะห์', Icon: BarChart3 },
  { href: '/admin/support', label: 'ซัพพอร์ต', Icon: User },
  { href: '/admin/ai-monitor', label: 'AI', Icon: Bot },
  { href: '/admin/logs', label: 'บันทึก', Icon: ClipboardList },
  { href: '/admin/export-jobs', label: 'ส่งออก', Icon: Download },
  { href: '/admin/settings', label: 'ตั้งค่า', Icon: SettingsIcon },
];

/** แถบหลักศูนย์ควบคุม — โลโก้ + ชื่อ + เมนูยาเลื่อนแนวนอน + ออกจากระบบ */
export function AdminHeader() {
  const { user, logout } = useSession();
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-white/95 backdrop-blur">
      <div className="mx-auto w-full max-w-5xl px-4">
        <div className="flex h-14 items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <BrandLogo />
            <div className="min-w-0">
              <p className="truncate-1 text-sm font-bold text-black">ศูนย์ควบคุมผู้ดูแลระบบ</p>
              <p className="text-[11px] text-neutral-400">{user ? `ผู้ดูแล: ${user.fullName}` : 'ฟู๊ด ธันเดอร์'}</p>
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
        <nav aria-label="เมนูศูนย์ควบคุม" className="flex gap-1.5 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {NAV.map(({ href, label, Icon }) => {
            const active = href === '/admin' ? pathname === '/admin' : pathname.startsWith(href);
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

/** แถบหน้าย่อย — ลูกศรย้อนกลับ + ไอคอน + ชื่อหน้า + ช่องขวา */
export function AdminSubHeader({
  title,
  subtitle,
  backHref = '/admin',
  Icon = Shield,
  right,
}: {
  title: string;
  subtitle?: string;
  backHref?: string;
  Icon?: typeof Shield;
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

/** ท้ายหน้าศูนย์ควบคุม — เหนียวล่างเมื่อเนื้อหาสั้น */
export function AdminFooter() {
  return (
    <footer className="mt-auto border-t border-line bg-white pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-4 text-center text-xs text-neutral-400">
      © {new Date().getFullYear()} ฟู๊ด ธันเดอร์ — ศูนย์ควบคุมผู้ดูแลระบบ
    </footer>
  );
}

/** โครงหน้าย่อยทั่วไป: SubHeader + main + footer */
export function AdminSubShell({
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
  Icon?: typeof Shield;
  right?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <AdminSubHeader title={title} subtitle={subtitle} backHref={backHref} Icon={Icon} right={right} />
      <main className="mx-auto w-full max-w-5xl flex-1 space-y-6 px-4 py-5">{children}</main>
      <AdminFooter />
    </div>
  );
}
