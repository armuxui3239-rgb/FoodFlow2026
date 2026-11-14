'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { CircleHelp, Headset, MessageCirclePlus } from 'lucide-react';
import { api, useSession } from '@/lib/client';
import { BrandLogo } from '@/components/brand-logo';

interface ChatSessionItem {
  id: string;
  type: string;
  is_active: boolean;
  created_at: string;
  last_message?: string | null;
  last_message_at?: string | null;
}

function thaiDate(iso: string): string {
  return new Date(iso).toLocaleDateString('th-TH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Bangkok',
  });
}

export default function MessagesPage() {
  const { user, ready: sessionReady } = useSession();
  const router = useRouter();
  const [sessions, setSessions] = useState<ChatSessionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);

  const load = useCallback(() => {
    api<{ data: ChatSessionItem[] }>('/api/chat/sessions')
      .then((r) => {
        setSessions(r.data);
        setError('');
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!sessionReady || !user) return;
    load();
  }, [user, sessionReady, load]);

  const startChat = useCallback(async () => {
    setCreating(true);
    setError('');
    try {
      const r = await api<{ data: ChatSessionItem }>('/api/chat/sessions', { method: 'POST' });
      router.push(`/messages/${r.data.id}`);
    } catch (e) {
      setError((e as Error).message);
      setCreating(false);
    }
  }, [router]);

  if (!sessionReady || (user && loading && !error)) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="กำลังโหลดข้อความ">
        <div className="h-7 w-24 animate-pulse rounded bg-neutral-100" />
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-20 animate-pulse rounded-3xl bg-neutral-100" />
        ))}
      </div>
    );
  }

  if (error && !sessions.length) {
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
        <h1 className="text-lg font-bold text-black">เข้าสู่ระบบเพื่อดูข้อความ</h1>
        <p className="text-sm text-neutral-400">ติดต่อฝ่ายบริการลูกค้าได้หลังเข้าสู่ระบบ</p>
        <Link href="/login?next=%2Fmessages" className="btn-brand inline-flex h-12 items-center px-8 text-sm">
          เข้าสู่ระบบ
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="pt-1 text-xl font-bold text-black">ข้อความ</h1>

      {error && (
        <p className="rounded-2xl bg-red-50 px-4 py-3 text-center text-xs text-red-500">{error}</p>
      )}

      {sessions.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-20 text-center">
          <span className="flex h-20 w-20 items-center justify-center rounded-full bg-neutral-100">
            <Headset className="h-9 w-9 text-neutral-300" aria-hidden />
          </span>
          <h2 className="text-lg font-bold text-black">ยังไม่มีบทสนทนา</h2>
          <p className="text-sm text-neutral-400">ทีมงานพร้อมช่วยเหลือคุณเสมอ</p>
          <button
            type="button"
            onClick={() => void startChat()}
            disabled={creating}
            data-testid="start-support-chat"
            className="btn-brand inline-flex h-12 items-center px-8 text-sm"
          >
            {creating ? 'กำลังเปิดบทสนทนา...' : 'ติดต่อฝ่ายบริการ'}
          </button>
        </div>
      ) : (
        <ul className="space-y-3">
          {sessions.map((s) => (
            <li key={s.id}>
              <Link
                href={`/messages/${s.id}`}
                data-testid={`chat-session-${s.id}`}
                className="flex items-center gap-3 rounded-3xl border border-line bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
              >
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-black">
                  <Headset className="h-6 w-6 text-[#FFC400]" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate-1 text-sm font-bold text-black">ฝ่ายบริการลูกค้า</p>
                  <p className="truncate-1 mt-0.5 text-xs text-neutral-400">
                    {s.last_message ?? 'แตะเพื่อเปิดบทสนทนา'}
                  </p>
                </div>
                <time className="shrink-0 text-[11px] text-neutral-400" dateTime={s.last_message_at ?? s.created_at}>
                  {thaiDate(s.last_message_at ?? s.created_at)}
                </time>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {sessions.length > 0 && (
        <div className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+5rem)] z-30 flex justify-center px-4">
          <button
            type="button"
            onClick={() => void startChat()}
            disabled={creating}
            data-testid="start-new-chat"
            className="btn-brand pointer-events-auto flex h-11 items-center gap-2 px-6 text-sm shadow-lg"
          >
            <MessageCirclePlus className="h-4.5 w-4.5" aria-hidden />
            {creating ? 'กำลังเปิดบทสนทนา...' : 'เริ่มบทสนทนาใหม่'}
          </button>
        </div>
      )}
    </div>
  );
}
