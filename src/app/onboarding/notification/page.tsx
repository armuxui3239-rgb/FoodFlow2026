'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { BellRing, CheckCircle2, PackageSearch, Sparkles, XCircle } from 'lucide-react';
import { AuthShell } from '@/components/auth-shell';

type PermState = 'idle' | 'granted' | 'denied' | 'unsupported';

const BENEFITS = [
  { Icon: PackageSearch, title: 'สถานะออเดอร์แบบเรียลไทม์', detail: 'รู้ทันทีเมื่อร้านรับออเดอร์ ไรเดอร์ออกส่ง และถึงหน้าบ้าน' },
  { Icon: Sparkles, title: 'โปรโมชั่นและโบนัสก่อนใคร', detail: 'ส่วนลดและโค้ดพิเศษจะเด้งเข้ามาให้ก่อนหมดแคมเปญ' },
  { Icon: BellRing, title: 'ข้อเสนอใหม่ในพื้นที่ของคุณ', detail: 'ร้านใหม่และเมนูยอดนิยมใกล้ที่อยู่ที่คุณตั้งไว้' },
];

/** ขั้นตอนขอสิทธิ์การแจ้งเตือน (ตามแม่แบบ onboarding_notification) — แทรกระหว่าง location → pin */
export default function NotificationSetupPage() {
  const router = useRouter();
  const [perm, setPerm] = useState<PermState>('idle');
  const [busy, setBusy] = useState(false);

  const enable = async () => {
    setBusy(true);
    try {
      if (typeof window === 'undefined' || !('Notification' in window)) {
        setPerm('unsupported');
      } else {
        setPerm((await window.Notification.requestPermission()) === 'granted' ? 'granted' : 'denied');
      }
    } catch {
      setPerm('denied');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell title="เปิดการแจ้งเตือน" backHref="/onboarding/location">
      <div className="mb-5 flex flex-col items-center text-center">
        <span className="flex h-20 w-20 items-center justify-center rounded-3xl bg-[#FFC400] text-black shadow-sm">
          <BellRing className="h-10 w-10" aria-hidden />
        </span>
        <p className="mt-4 text-sm leading-relaxed text-ink-soft">
          อย่าพลาดสถานะอาหารของคุณ — เปิดการแจ้งเตือนแล้วเราจะบอกคุณทุกขั้นตอนตั้งแต่ร้านรับออเดอร์จนถึงประตูบ้าน
        </p>
      </div>

      <ul className="mb-5 space-y-3">
        {BENEFITS.map(({ Icon, title, detail }) => (
          <li key={title} className="flex items-start gap-3 rounded-2xl bg-neutral-50 px-4 py-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#FFF4CC] text-black">
              <Icon className="h-4.5 w-4.5" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-bold text-ink">{title}</p>
              <p className="text-xs leading-relaxed text-ink-soft">{detail}</p>
            </div>
          </li>
        ))}
      </ul>

      {perm === 'granted' && (
        <p role="status" className="mb-3 flex items-center gap-2 rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          <CheckCircle2 className="h-4.5 w-4.5 shrink-0" aria-hidden /> เปิดการแจ้งเตือนสำเร็จแล้ว
        </p>
      )}
      {(perm === 'denied' || perm === 'unsupported') && (
        <p role="status" className="mb-3 flex items-start gap-2 rounded-2xl bg-neutral-100 px-4 py-3 text-xs leading-relaxed text-ink-soft">
          <XCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          {perm === 'denied'
            ? 'เบราว์เซอร์บล็อกการแจ้งเตือนไว้ — เปลี่ยนได้ภายหลังที่ตั้งค่าเบราว์เซอร์ หรือตั้งค่าในหน้า "การแจ้งเตือน"'
            : 'อุปกรณ์นี้ไม่รองรับการแจ้งเตือน — ข้ามขั้นตอนนี้ได้เลย'}
        </p>
      )}

      <div className="space-y-2">
        {perm === 'granted' ? (
          <button
            type="button"
            onClick={() => router.push('/onboarding/pin')}
            data-testid="notify-next"
            className="btn-brand w-full rounded-full py-3.5 text-sm"
          >
            ถัดไป
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={() => void enable()}
              disabled={busy}
              data-testid="notify-enable"
              className="btn-brand w-full rounded-full py-3.5 text-sm disabled:opacity-60"
            >
              {busy ? 'กำลังขอสิทธิ์...' : 'เปิดการแจ้งเตือน'}
            </button>
            <button
              type="button"
              onClick={() => router.push('/onboarding/pin')}
              className="w-full rounded-full py-3 text-sm font-semibold text-ink-soft transition hover:bg-neutral-50"
            >
              ข้ามก่อนตอนนี้
            </button>
          </>
        )}
      </div>
    </AuthShell>
  );
}
