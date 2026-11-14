'use client';

import { useCallback, useEffect, useState } from 'react';
import { Bell, BellOff, CheckCheck } from 'lucide-react';
import { api } from '@/lib/client';
import { DriverFooter, DriverHeader } from '@/components/portal/driver-header';

interface Notification {
  id: string;
  title: string;
  body: string | null;
  type: string | null;
  is_read: boolean;
  created_at: string;
}

const fmt = (iso: string) =>
  new Date(iso).toLocaleString('th-TH', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

export default function DriverNotificationsPage() {
  const [items, setItems] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api<{ data: Notification[]; unread: number }>('/api/driver/notifications')
      .then((r) => {
        setItems(r.data);
        setUnread(r.unread);
        setError('');
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  const markRead = async (id: string) => {
    try {
      await api(`/api/driver/notifications/${id}`, { method: 'PATCH', body: JSON.stringify({ is_read: true }) });
      setItems((list) => list.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
      setUnread((u) => Math.max(0, u - 1));
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const markAll = async () => {
    try {
      await api('/api/driver/notifications', { method: 'PATCH', body: JSON.stringify({ all: true }) });
      setItems((list) => list.map((n) => ({ ...n, is_read: true })));
      setUnread(0);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <DriverHeader />

      <main className="mx-auto w-full max-w-5xl flex-1 space-y-4 px-4 py-5">
        <div className="flex items-center justify-between gap-2">
          <h1 className="flex items-center gap-2 text-lg font-bold text-black">
            <Bell className="h-5 w-5" aria-hidden /> แจ้งเตือน
            {unread > 0 && (
              <span className="rounded-full bg-[#FFC400] px-2 py-0.5 text-[11px] font-bold text-black">
                {unread} ใหม่
              </span>
            )}
          </h1>
          {unread > 0 && (
            <button
              onClick={() => void markAll()}
              className="flex h-10 items-center gap-1.5 rounded-full border border-line px-3 text-xs font-semibold text-neutral-600 transition-colors hover:bg-[#FFF4CC]"
            >
              <CheckCheck className="h-4 w-4" aria-hidden /> อ่านทั้งหมด
            </button>
          )}
        </div>

        {error && (
          <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </p>
        )}

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-3xl bg-neutral-100" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-line px-4 py-10 text-center">
            <BellOff className="mx-auto h-8 w-8 text-neutral-300" aria-hidden />
            <p className="mt-2 text-sm text-neutral-400">ยังไม่มีการแจ้งเตือน</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {items.map((n) => (
              <li key={n.id}>
                <button
                  onClick={() => (n.is_read ? undefined : void markRead(n.id))}
                  disabled={n.is_read}
                  className={`flex w-full items-start gap-3 rounded-3xl border p-4 text-left transition-colors ${
                    n.is_read
                      ? 'border-line bg-white'
                      : 'border-[#FFC400] bg-[#FFF4CC] cursor-pointer hover:border-[#e6b000]'
                  }`}
                >
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                      n.is_read ? 'bg-neutral-100 text-neutral-400' : 'bg-black text-[#FFC400]'
                    }`}
                  >
                    <Bell className="h-4.5 w-4.5" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate-1 text-sm font-bold text-black">{n.title}</span>
                      <span className="shrink-0 text-[11px] text-neutral-400">{fmt(n.created_at)}</span>
                    </span>
                    {n.body && <span className="mt-0.5 block text-xs text-neutral-600">{n.body}</span>}
                    {!n.is_read && <span className="mt-1 block text-[11px] font-bold text-neutral-500">แตะเพื่อทำเครื่องหมายว่าอ่านแล้ว</span>}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </main>

      <DriverFooter />
    </div>
  );
}
