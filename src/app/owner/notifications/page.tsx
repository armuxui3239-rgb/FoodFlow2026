'use client';

import { useCallback, useEffect, useState } from 'react';
import { Bell, CheckCheck, ClipboardList, Settings as SettingsIcon, Tag } from 'lucide-react';
import { api } from '@/lib/client';
import { OwnerSubShell } from '@/components/portal/owner-header';

interface Noti {
  id: string;
  title: string;
  body: string | null;
  type: string;
  is_read: boolean;
  created_at: string;
}

/** ไอคอนตามประเภทแจ้งเตือน */
function typeIcon(type: string): typeof Bell {
  if (type === 'order') return ClipboardList;
  if (type === 'promo') return Tag;
  if (type === 'system') return SettingsIcon;
  return Bell;
}

/** เวลาแบบสัมพัทธ์ภาษาไทย */
function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'เมื่อสักครู่';
  if (m < 60) return `${m} นาทีที่แล้ว`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} ชั่วโมงที่แล้ว`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d} วันที่แล้ว`;
  return new Date(iso).toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** หน้าแจ้งเตือน — อ่านทั้งหมด หรือคลิกแต่ละรายการเพื่อทำเครื่องหมายว่าอ่านแล้ว */
export default function OwnerNotificationsPage() {
  const [notis, setNotis] = useState<Noti[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [marking, setMarking] = useState(false);

  const load = useCallback(() => {
    setError('');
    api<{ data: Noti[]; unreadCount: number }>('/api/owner/notifications')
      .then((d) => {
        setNotis(d.data);
        setUnread(d.unreadCount);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  const markAll = async () => {
    setMarking(true);
    setError('');
    try {
      await api('/api/owner/notifications', { method: 'PATCH', body: JSON.stringify({ all: true }) });
      setNotis((xs) => xs.map((n) => ({ ...n, is_read: true })));
      setUnread(0);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setMarking(false);
    }
  };

  const markOne = async (n: Noti) => {
    if (n.is_read) return;
    setNotis((xs) => xs.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)));
    setUnread((u) => Math.max(0, u - 1));
    try {
      await api(`/api/owner/notifications/${n.id}`, { method: 'PATCH', body: JSON.stringify({ is_read: true }) });
    } catch {
      setNotis((xs) => xs.map((x) => (x.id === n.id ? { ...x, is_read: false } : x)));
      setUnread((u) => u + 1);
    }
  };

  return (
    <OwnerSubShell
      title="แจ้งเตือน"
      subtitle={unread > 0 ? `ยังไม่อ่าน ${unread} รายการ` : 'อ่านครบทุกรายการแล้ว'}
      Icon={Bell}
      right={
        <button
          onClick={() => void markAll()}
          disabled={unread === 0 || marking}
          className="flex h-10 shrink-0 items-center gap-1.5 rounded-full border border-line px-3 text-xs font-semibold text-neutral-600 transition-colors hover:bg-neutral-50 disabled:opacity-40"
        >
          <CheckCheck className="h-4 w-4" aria-hidden /> อ่านทั้งหมด
        </button>
      }
    >
      {error && (
        <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </p>
      )}

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-3xl bg-neutral-100" />
          ))}
        </div>
      ) : notis.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-line px-4 py-10 text-center">
          <Bell className="mx-auto h-8 w-8 text-neutral-300" aria-hidden />
          <p className="mt-2 text-sm text-neutral-400">ยังไม่มีการแจ้งเตือน</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {notis.map((n) => {
            const Icon = typeIcon(n.type);
            return (
              <li key={n.id}>
                <button
                  onClick={() => void markOne(n)}
                  className="flex w-full items-start gap-3 rounded-3xl border border-line bg-white p-4 text-left shadow-sm transition-colors hover:border-[#FFC400]"
                >
                  <span
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${
                      n.is_read ? 'bg-neutral-100 text-neutral-400' : 'bg-[#FFF4CC] text-black'
                    }`}
                  >
                    <Icon className="h-5 w-5" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className={`truncate-1 text-sm font-bold ${n.is_read ? 'text-neutral-500' : 'text-black'}`}>{n.title}</p>
                      {!n.is_read && <span className="h-2 w-2 shrink-0 rounded-full bg-[#FFC400]" aria-label="ยังไม่อ่าน" />}
                    </div>
                    {n.body && <p className={`mt-0.5 truncate-1 text-xs ${n.is_read ? 'text-neutral-400' : 'text-neutral-500'}`}>{n.body}</p>}
                    <p className="mt-1 text-[11px] text-neutral-300">{relTime(n.created_at)}</p>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </OwnerSubShell>
  );
}
