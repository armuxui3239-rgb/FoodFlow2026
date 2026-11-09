'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, CircleHelp, Headset, Send } from 'lucide-react';
import { api } from '@/lib/client';

interface ChatMessage {
  id: string;
  session_id: string;
  sender_type: string;
  sender_id: string | null;
  content: string;
  created_at: string;
}

function thaiTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('th-TH', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Bangkok',
  });
}

const POLL_INTERVAL = 4000;

export default function ChatPage() {
  const { id } = useParams<{ id: string }>();
  const [messages, setMessages] = useState<ChatMessage[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const prevCount = useRef(0);

  const load = useCallback(() => {
    // ไม่ poll ระหว่างแท็บซ่อนอยู่
    if (document.hidden) return;
    api<{ data: ChatMessage[] }>(`/api/chat/sessions/${id}`)
      .then((r) => {
        setMessages(r.data);
        setError('');
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    load();
    const timer = setInterval(load, POLL_INTERVAL);
    const onVisible = () => {
      if (!document.hidden) load();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [load]);

  // เลื่อนลงล่างอัตโนมัติเมื่อมีข้อความใหม่
  useEffect(() => {
    if (!messages || messages.length === 0) return;
    if (messages.length > prevCount.current) {
      bottomRef.current?.scrollIntoView({ behavior: prevCount.current === 0 ? 'auto' : 'smooth' });
    }
    prevCount.current = messages.length;
  }, [messages]);

  const send = async () => {
    const content = text.trim();
    if (!content || sending) return;
    setSending(true);
    setSendError('');
    try {
      const r = await api<{ data: ChatMessage[] }>(`/api/chat/sessions/${id}`, {
        method: 'POST',
        body: JSON.stringify({ content }),
      });
      setMessages(r.data);
      setText('');
    } catch (e) {
      setSendError((e as Error).message);
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-3 pt-2" aria-busy="true" aria-label="กำลังโหลดข้อความ">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className={`flex ${i % 2 === 0 ? 'justify-start' : 'justify-end'}`}>
            <div className="h-14 w-40 animate-pulse rounded-3xl bg-neutral-100" />
          </div>
        ))}
        <div className="h-11 animate-pulse rounded-full bg-neutral-100" />
      </div>
    );
  }

  if (error && !messages) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-red-50">
          <CircleHelp className="h-8 w-8 text-red-400" aria-hidden />
        </span>
        <p className="text-sm text-red-500">{error}</p>
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setError('');
              setLoading(true);
              load();
            }}
            className="btn-brand h-11 rounded-full px-6 text-sm"
          >
            ลองอีกครั้ง
          </button>
          <Link
            href="/messages"
            className="flex h-11 items-center rounded-full border border-line bg-white px-6 text-sm font-semibold text-black"
          >
            กลับหน้าข้อความ
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[70vh] flex-col">
      {/* แถบหัวบทสนทนา */}
      <header className="sticky top-14 z-30 -mx-4 mb-4 flex items-center gap-3 border-b border-line bg-white/95 px-4 py-2.5 backdrop-blur">
        <Link
          href="/messages"
          aria-label="ย้อนกลับ"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-neutral-100"
        >
          <ArrowLeft className="h-5 w-5 text-black" aria-hidden />
        </Link>
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-black">
          <Headset className="h-5 w-5 text-[#FFC400]" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate-1 text-sm font-bold text-black">ฝ่ายบริการลูกค้า</p>
          <p className="flex items-center gap-1.5 text-[11px] text-emerald-600">
            <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden />
            ออนไลน์
          </p>
        </div>
      </header>

      {/* รายการข้อความ */}
      <div className="flex-1 space-y-3 pb-28">
        {messages && messages.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-neutral-100">
              <Headset className="h-7 w-7 text-neutral-300" aria-hidden />
            </span>
            <p className="text-sm font-bold text-black">ยังไม่มีข้อความ</p>
            <p className="text-xs text-neutral-400">เริ่มพูดคุยกับฝ่ายบริการลูกค้าได้เลย</p>
            <button
              type="button"
              onClick={() => setText('สอบถามสถานะคำสั่งซื้อของฉัน')}
              className="flex h-11 items-center rounded-full border border-line bg-white px-5 text-xs font-semibold text-black transition-colors hover:bg-[#FFF4CC]"
            >
              สอบถามสถานะคำสั่งซื้อ
            </button>
          </div>
        )}

        {messages?.map((m) => {
          const mine = m.sender_type === 'customer';
          return (
            <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div className="flex max-w-[80%] flex-col gap-1">
                <div
                  className={`px-4 py-3 text-sm leading-relaxed ${
                    mine
                      ? 'rounded-3xl rounded-br-md bg-black text-[#FFF4CC]'
                      : 'rounded-3xl rounded-bl-md border border-line bg-white text-black'
                  }`}
                >
                  <p className="whitespace-pre-wrap break-words">{m.content}</p>
                </div>
                <time
                  dateTime={m.created_at}
                  className={`px-1 text-[10px] text-neutral-400 ${mine ? 'text-right' : 'text-left'}`}
                >
                  {thaiTime(m.created_at)}
                </time>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* แจ้งเตือนการเชื่อมต่อขัดข้องชั่วคราว */}
      {error && messages && (
        <p className="fixed inset-x-4 bottom-[calc(env(safe-area-inset-bottom)+8.75rem)] z-30 mx-auto max-w-[calc(40rem-2rem)] rounded-2xl bg-red-50 px-4 py-2 text-center text-xs text-red-500">
          {error} — กำลังลองใหม่อัตโนมัติ
        </p>
      )}

      {/* กล่องพิมพ์ข้อความ */}
      <div className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+3.5rem)] z-30 border-t border-line bg-white/95 px-4 py-3 backdrop-blur">
        {sendError && (
          <p className="mb-2 text-center text-xs text-red-500">{sendError}</p>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
          className="mx-auto flex max-w-5xl items-center gap-2"
        >
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={1000}
            placeholder="พิมพ์ข้อความของคุณ..."
            aria-label="พิมพ์ข้อความ"
            data-testid="chat-input"
            className="h-11 flex-1 rounded-full border border-line bg-white px-4 text-sm text-black outline-none transition-colors placeholder:text-neutral-400 focus:border-[#FFC400]"
          />
          <button
            type="submit"
            disabled={!text.trim() || sending}
            aria-label="ส่งข้อความ"
            data-testid="chat-send"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#FFC400] text-black transition hover:brightness-95 disabled:opacity-50"
          >
            <Send className="h-5 w-5" aria-hidden />
          </button>
        </form>
      </div>
    </div>
  );
}
