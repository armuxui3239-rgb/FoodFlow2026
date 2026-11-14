'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import {
  Bell,
  BellOff,
  CheckCheck,
  CircleHelp,
  Info,
  PackageCheck,
  Percent,
} from 'lucide-react';
import { api, useSession } from '@/lib/client';
import { BrandLogo } from '@/components/brand-logo';

interface NotificationRow {
  id: string;
  title: string;
  body: string | null;
  type: string;
  is_read: boolean;
  created_at: string;
}

const TYPE_META: Record<string, { Icon: typeof Bell; label: string }> = {
  order: { Icon: PackageCheck, label: 'คำสั่งซื้อ' },
  promotion: { Icon: Percent, label: 'โปรโมชัน' },
  system: { Icon: Info, label: 'ระบบ' },
};

function typeMeta(type: string) {
  return TYPE_META[type] ?? { Icon: Bell, label: 'แจ้งเตือน' };
}

function thaiDate(iso: string): string {
  return new Date(iso).toLocaleDateString('th-TH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Bangkok',
  });
}

export default function NotificationsPage() {
  const { user, ready: sessionReady } = useSession();
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [markingAll, setMarkingAll] = useState(false);

  const load = useCallback(() => {
    api<{ data: NotificationRow[] }>('/api/notifications')
      .then((r) => {
        setItems(r.data);
        setError('');
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!sessionReady || !user) return;
    load();
  }, [user, sessionReady, load]);

  const markAll = async () => {
    setMarkingAll(true);
    try {
      await api('/api/notifications', {
        method: 'PATCH',
        body: JSON.stringify({ all: true }),
      });
      load(); // reload รายการหลังอ่านทั้งหมด
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setMarkingAll(false);
    }
  };

  const markOne = async (n: NotificationRow) => {
    if (n.is_read) return;
    setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)));
    try {
      await api('/api/notifications', {
        method: 'PATCH',
        body: JSON.stringify({ id: n.id }),
      });
    } catch {
      // อ่านไม่สำเร็จ — คืนสถานะเดิม
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, is_read: false } : x)));
    }
  };

  if (!sessionReady || (user && loading && !error)) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="กำลังโหลดการแจ้งเตือน">
        <div className="flex items-center justify-between pt-1">
          <div className="h-7 w-32 animate-pulse rounded bg-neutral-100" />
          <div className="h-11 w-32 animate-pulse rounded-full bg-neutral-100" />
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-3xl bg-neutral-100" />
        ))}
      </div>
    );
  }

  if (error && !items.length) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-red-50">
          <CircleHelp className="h-8 w-8 text-red-400" aria-hidden />
        </span>
        <p className="text-sm text-red-500">{error}</p>
        <button onClick={load} className="btn-brand h-11 rounded-full px-6 text-sm">
          ลองอีกครั้ง
        </button>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <BrandLogo className="h-20 w-20 rounded-3xl shadow-sm" />
        <h1 className="text-lg font-bold text-black">เข้าสู่ระบบเพื่อดูการแจ้งเตือน</h1>
        <p className="text-sm text-neutral-400">ติดตามสถานะคำสั่งซื้อและโปรโมชันของคุณ</p>
        <Link href="/login?next=%2Fnotifications" className="btn-brand inline-flex h-12 items-center px-8 text-sm">
          เข้าสู่ระบบ
        </Link>
      </div>
    );
  }

  const unreadCount = items.filter((n) => !n.is_read).length;

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between gap-3 pt-1">
        <h1 className="text-xl font-bold text-black">การแจ้งเตือน</h1>
        <button
          type="button"
          onClick={() => void markAll()}
          disabled={markingAll || unreadCount === 0}
          data-testid="mark-all-read"
          className="flex h-11 shrink-0 items-center gap-1.5 rounded-full border border-line bg-white px-4 text-xs font-semibold text-black transition-colors hover:bg-[#FFF4CC] disabled:opacity-50"
        >
          <CheckCheck className="h-4 w-4" aria-hidden />
          อ่านทั้งหมดด้วย
        </button>
      </header>

      {error && (
        <p className="rounded-2xl bg-red-50 px-4 py-3 text-center text-xs text-red-500">{error}</p>
      )}

      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-20 text-center">
          <span className="flex h-20 w-20 items-center justify-center rounded-full bg-neutral-100">
            <BellOff className="h-9 w-9 text-neutral-300" aria-hidden />
          </span>
          <h2 className="text-lg font-bold text-black">ยังไม่มีการแจ้งเตือน</h2>
          <p className="text-sm text-neutral-400">ยังไม่มีอะไรให้แสดงในขณะนี้</p>
          <Link href="/" className="btn-brand inline-flex h-12 items-center px-8 text-sm">
            สั่งอาหารเลย
          </Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map((n) => {
            const { Icon, label } = typeMeta(n.type);
            return (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => void markOne(n)}
                  data-testid={`notification-${n.id}`}
                  className={`relative block w-full rounded-3xl border p-4 text-left transition-colors ${
                    n.is_read
                      ? 'border-line bg-white hover:bg-neutral-50'
                      : 'border-[#FFC400]/60 bg-[#FFF4CC]/40'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${
                        n.is_read ? 'bg-[#FFF4CC]' : 'bg-[#FFC400]'
                      }`}
                    >
                      <Icon className="h-5 w-5 text-black" aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate-1 text-sm font-bold text-black">{n.title}</p>
                      {n.body && <p className="truncate-2 mt-0.5 text-xs text-neutral-500">{n.body}</p>}
                      <p className="mt-1.5 flex items-center gap-2 text-[11px] text-neutral-400">
                        <span className="rounded-full bg-neutral-100 px-2 py-0.5 font-medium text-neutral-500">
                          {label}
                        </span>
                        {thaiDate(n.created_at)}
                      </p>
                    </div>
                  </div>
                  {!n.is_read && (
                    <span
                      className="absolute right-3 top-3 h-2.5 w-2.5 rounded-full bg-[#FFC400]"
                      aria-label="ยังไม่ได้อ่าน"
                    />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
