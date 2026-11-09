'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
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
const GROUPS: { href: string; label: string; desc: string; Icon: typeof Bell; testid: string }[] = [
  { href: '/settings/notifications', label: 'การแจ้งเตือน', desc: 'จัดการการแจ้งเตือนออเดอร์และโปรโมชั่น', Icon: Bell, testid: 'settings-notifications' },
  { href: '/settings/security', label: 'ความปลอดภัย', desc: 'รหัสผ่าน PIN และการยืนยันตัวตน', Icon: ShieldCheck, testid: 'settings-security' },
  { href: '/profile/edit', label: 'ข้อมูลส่วนตัว', desc: 'ชื่อ เบอร์โทร และอีเมลของคุณ', Icon: UserCog, testid: 'settings-profile' },
  { href: '/addresses', label: 'ที่อยู่จัดส่ง', desc: 'จัดการที่อยู่บ้าน ที่ทำงาน และอื่น ๆ', Icon: MapPin, testid: 'settings-addresses' },
  { href: '/wallet', label: 'กระเป๋าเงิน', desc: 'ยอดเงินคงเหลือและประวัติธุรกรรม', Icon: Wallet, testid: 'settings-wallet' },
  { href: '/language', label: 'ภาษา', desc: 'เปลี่ยนภาษาของแอป', Icon: Languages, testid: 'settings-language' },
  { href: '/help', label: 'ศูนย์ช่วยเหลือ', desc: 'คำถามที่พบบ่อยและติดต่อทีมงาน', Icon: CircleHelp, testid: 'settings-help' },
];

export default function SettingsPage() {
  const { user } = useSession();
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
        <h1 className="text-lg font-bold text-black">การตั้งค่า</h1>
      </header>

      {user ? (
        <p className="text-xs text-neutral-500">
          บัญชี: <span className="font-semibold text-black">{user.fullName}</span>
        </p>
      ) : loading ? (
        <div className="h-4 w-40 animate-pulse rounded-full bg-neutral-100" />
      ) : null}

      <ul className="overflow-hidden rounded-3xl border border-line bg-white shadow-sm" aria-label="รายการการตั้งค่า">
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
                <span className="block text-sm font-bold text-black">{g.label}</span>
                <span className="block truncate-1 text-xs text-neutral-400">{g.desc}</span>
              </span>
              <ChevronRight className="h-5 w-5 shrink-0 text-neutral-300" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
