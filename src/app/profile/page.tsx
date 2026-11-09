'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  Bell,
  CircleHelp,
  ChevronRight,
  Coins,
  Gift,
  Heart,
  Languages,
  LogOut,
  MapPin,
  Package,
  Percent,
  ShieldCheck,
  Wallet,
  Zap,
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { api, useSession } from '@/lib/client';

interface ProfileData {
  id: string;
  email: string;
  phone: string | null;
  fullName: string;
  avatarUrl: string | null;
  phoneVerified: boolean;
  memberSince: string;
  totalOrders: number;
  defaultAddress: { id: string; label: string; address_line: string } | null;
}

const MENU: { href: string; label: string; Icon: typeof Heart; testid: string }[] = [
  { href: '/favorites', label: 'ร้านโปรดของฉัน', Icon: Heart, testid: 'menu-favorites' },
  { href: '/offers', label: 'ข้อเสนอพิเศษและคูปอง', Icon: Percent, testid: 'menu-offers' },
  { href: '/points', label: 'แต้มสะสมของฉัน', Icon: Coins, testid: 'menu-points' },
  { href: '/wallet', label: 'กระเป๋าเงิน', Icon: Wallet, testid: 'menu-wallet' },
  { href: '/addresses', label: 'ที่อยู่ของฉัน', Icon: MapPin, testid: 'menu-addresses' },
  { href: '/settings/notifications', label: 'การแจ้งเตือน', Icon: Bell, testid: 'menu-notifications' },
  { href: '/settings/security', label: 'ความปลอดภัย', Icon: ShieldCheck, testid: 'menu-security' },
  { href: '/language', label: 'ภาษา', Icon: Languages, testid: 'menu-language' },
  { href: '/invite', label: 'เชิญเพื่อนรับส่วนลด', Icon: Gift, testid: 'menu-invite' },
  { href: '/help', label: 'ศูนย์ช่วยเหลือ', Icon: CircleHelp, testid: 'menu-help' },
];

/** แสดงเบอร์ไทย 0xxxxxxxxx เป็นรูปแบบนานาชาติ +66 */
function displayPhone(p: string | null): string {
  if (!p) return 'ยังไม่ระบุเบอร์';
  return p.startsWith('0') ? `+66 ${p.slice(1)}` : p;
}

export default function ProfilePage() {
  const { user, ready: sessionReady, logout } = useSession();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [confirmLogout, setConfirmLogout] = useState(false);

  useEffect(() => {
    if (!sessionReady || !user) return;
    let cancelled = false;
    api<{ data: ProfileData }>('/api/profile')
      .then((r) => {
        if (!cancelled) setProfile(r.data);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user, sessionReady]);

  if (!sessionReady || (user && loading && !error)) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="กำลังโหลดโปรไฟล์">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 animate-pulse rounded-full bg-neutral-100" />
          <div className="flex-1 space-y-2">
            <div className="h-5 w-40 animate-pulse rounded bg-neutral-100" />
            <div className="h-4 w-28 animate-pulse rounded bg-neutral-100" />
          </div>
        </div>
        <div className="h-24 animate-pulse rounded-3xl bg-neutral-100" />
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-14 animate-pulse rounded-2xl bg-neutral-100" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-red-50">
          <CircleHelp className="h-8 w-8 text-red-400" aria-hidden />
        </span>
        <p className="text-sm text-red-500">{error}</p>
        <button onClick={() => window.location.reload()} className="btn-brand h-11 rounded-full px-6 text-sm">
          ลองอีกครั้ง
        </button>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <span className="flex h-20 w-20 items-center justify-center rounded-full bg-neutral-100">
          <Zap className="h-9 w-9 text-[#FFC400]" aria-hidden />
        </span>
        <h1 className="text-lg font-bold text-black">เข้าสู่ระบบเพื่อดูโปรไฟล์</h1>
        <p className="text-sm text-neutral-400">จัดการบัญชี ที่อยู่ และคำสั่งซื้อของคุณ</p>
        <Link href="/login?next=%2Fprofile" className="btn-brand inline-flex h-12 items-center px-8 text-sm">
          เข้าสู่ระบบ
        </Link>
      </div>
    );
  }

  const initial = (profile?.fullName ?? user.fullName ?? 'ผ').trim().slice(0, 1);

  return (
    <div className="space-y-5">
      {/* หัวโปรไฟล์ — ตามต้นแบบ: รูป + ชื่อ + เบอร์ + ปุ่มแก้ไข */}
      <header className="flex items-center gap-4 pt-1">
        <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-black text-2xl font-bold text-[#FFC400]">
          {profile?.avatarUrl ? (
            <img src={profile.avatarUrl} alt={`รูปโปรไฟล์ ${user.fullName}`} className="h-full w-full rounded-full object-cover" />
          ) : (
            initial
          )}
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="truncate-1 text-lg font-bold text-black">{profile?.fullName ?? user.fullName}</h1>
          <p className="flex items-center gap-1.5 text-xs text-neutral-400">
            {displayPhone(profile?.phone ?? null)}
            {profile?.phoneVerified && (
              <span className="inline-flex items-center rounded-full bg-[#FFF4CC] px-1.5 py-0.5 text-[10px] font-bold text-black">
                ยืนยันแล้ว
              </span>
            )}
          </p>
        </div>
        <Link
          href="/profile/edit"
          className="flex h-10 shrink-0 items-center gap-1 rounded-full border border-line px-4 text-xs font-semibold text-black transition-colors hover:bg-[#FFF4CC]"
        >
          แก้ไข
          <ChevronRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </header>

      {/* สรุปสถิติ — จำนวนคำสั่งซื้อ + วันที่เริ่มใช้ (พ.ศ.) */}
      <section aria-label="สรุปกิจกรรม" className="grid grid-cols-2 gap-3">
        <Link
          href="/orders"
          className="flex items-center gap-3 rounded-3xl border border-line bg-white p-4 transition-shadow hover:shadow-md"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#FFF4CC]">
            <Package className="h-5 w-5 text-black" aria-hidden />
          </span>
          <span>
            <span className="block text-lg font-bold tabular-nums leading-tight text-black">
              {profile?.totalOrders ?? 0}
            </span>
            <span className="block text-[11px] text-neutral-400">คำสั่งซื้อทั้งหมด</span>
          </span>
        </Link>
        <div className="flex items-center gap-3 rounded-3xl border border-line bg-white p-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#FFF4CC]">
            <Zap className="h-5 w-5 text-black" aria-hidden />
          </span>
          <span>
            <span className="block text-sm font-bold leading-tight text-black">สมาชิก Food Thunder</span>
            <span className="block text-[11px] text-neutral-400">
              ตั้งแต่{' '}
              {profile?.memberSince
                ? new Date(profile.memberSince).toLocaleDateString('th-TH', {
                    year: 'numeric',
                    month: 'short',
                    timeZone: 'Asia/Bangkok',
                  })
                : '-'}
            </span>
          </span>
        </div>
      </section>

      {/* เมนูการตั้งค่า — ตามต้นแบบ */}
      <nav aria-label="เมนูโปรไฟล์">
        <ul className="overflow-hidden rounded-3xl border border-line bg-white">
          {MENU.map(({ href, label, Icon, testid }, i) => (
            <li key={href}>
              <Link
                href={href}
                data-testid={testid}
                className={`flex items-center gap-3 px-4 py-4 transition-colors hover:bg-[#FFF4CC]/60 ${
                  i > 0 ? 'border-t border-line' : ''
                }`}
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#FFF4CC]">
                  <Icon className="h-4.5 w-4.5 text-black" aria-hidden />
                </span>
                <span className="flex-1 text-sm font-medium text-black">{label}</span>
                <ChevronRight className="h-4 w-4 shrink-0 text-neutral-300" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {/* ออกจากระบบ — ยืนยันก่อนตามต้นแบบ */}
      <button
        type="button"
        data-testid="logout-button"
        onClick={() => setConfirmLogout(true)}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-full border border-line bg-white text-sm font-semibold text-red-500 transition-colors hover:bg-red-50"
      >
        <LogOut className="h-4 w-4" aria-hidden />
        ออกจากระบบ
      </button>

      <AlertDialog open={confirmLogout} onOpenChange={setConfirmLogout}>
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle>ยืนยันการออกจากระบบ</AlertDialogTitle>
            <AlertDialogDescription>คุณแน่ใจหรือไม่ว่าต้องการออกจากระบบ?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row gap-2">
            <AlertDialogCancel className="mt-0 flex-1 rounded-full border-line">ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              className="flex-1 rounded-full bg-black text-[#FFC400] hover:bg-black/90"
              onClick={() => void logout()}
            >
              ออกจากระบบ
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
