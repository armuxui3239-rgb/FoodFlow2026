'use client';

import { SupabaseClient, type RealtimeChannel } from '@supabase/supabase-js';
import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/client';

/**
 * ตัวช่วย Supabase Realtime Broadcast ฝั่ง client — นโยบายจบในระบบ:
 * ช่องแชทเป็น public channel ชื่อคาดเดาไม่ได้ (chat:{sessionId}:{hmac8}) ที่ API ของเรา
 * คืนเฉพาะผู้ร่วมสนทนาที่ยืนยันแล้ว ส่วน payload broadcast มีแค่สัญญาณ
 * {type:'new-message', sessionId} ไม่มีเนื้อหาข้อความ — เนื้อหาจะดึงใหม่จาก API ของเราเสมอ
 */

export type ChatSignal = { type: string; sessionId: string };

export type ChatMessage = {
  id: string;
  session_id: string;
  sender_type: string;
  sender_id: string | null;
  content: string;
  created_at: string;
};

export type OrderChatSession = {
  id: string;
  type: string;
  order_id: string | null;
  is_active: boolean;
};

export type OrderChatData = {
  session: OrderChatSession;
  messages: ChatMessage[];
  channel: string;
};

let client: SupabaseClient | null = null;

/** Supabase client สำหรับ Realtime — ใช้ตัวเดียวร่วมกันทั้งแอป (module singleton) */
export function createRealtimeClient(): SupabaseClient {
  if (!client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) {
      throw new Error('ยังไม่ได้ตั้งค่า NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY');
    }
    client = new SupabaseClient(url, key, {
      realtime: { params: { eventsPerSecond: 5 } },
    });
  }
  return client;
}

/** ขอชื่อช่อง broadcast จาก API — เซิร์ฟเวอร์คำนวณ HMAC และตรวจสิทธิ์ผู้ร่วมสนทนาให้เอง */
export async function getChannelName(sessionId: string): Promise<string> {
  const res = await api<{ channel: string }>(`/api/chat/sessions/${encodeURIComponent(sessionId)}/channel`);
  return res.channel;
}

export interface ChatSubscription {
  channel: RealtimeChannel;
  /** ยกเลิกการฟังช่องนี้ (removeChannel) */
  unsubscribe: () => void;
}

/**
 * ฟัง broadcast บนช่องแชท — event 'message' พกสัญญาณเท่านั้น
 * onStatus ได้สถานะ subscribe จริง ('SUBSCRIBED' | 'CHANNEL_ERROR' | 'TIMED_OUT' | 'CLOSED')
 * ผู้เรียกใช้สถานะนี้เพื่อเปิด polling สำรองเมื่อ subscribe ล้มเหลว
 */
export function subscribeChat(
  channelName: string,
  onSignal: (signal: ChatSignal) => void,
  onStatus?: (status: string) => void,
): ChatSubscription {
  const ch = createRealtimeClient().channel(channelName);
  ch.on<ChatSignal>('broadcast', { event: 'message' }, (msg) => {
    const payload = msg?.payload;
    if (payload && typeof payload === 'object') onSignal(payload);
  });
  ch.subscribe((status) => onStatus?.(status));
  return {
    channel: ch,
    unsubscribe: () => {
      void createRealtimeClient().removeChannel(ch);
    },
  };
}

export interface UseOrderChatResult {
  session: OrderChatSession | null;
  messages: ChatMessage[];
  loading: boolean;
  error: string;
  sending: boolean;
  /** ข้อความนี้เป็นของฉันเองหรือไม่ (เทียบ sender_id กับ myUserId) */
  isMine: (m: ChatMessage) => boolean;
  /** ส่งข้อความ — คืน true เมื่อสำเร็จ (ผู้ส่งได้ข้อความในตอนตอบกลับ ไม่ต้องรอสัญญาณ) */
  send: (content: string) => Promise<boolean>;
}

/**
 * แชทรายออเดอร์ที่ใช้ร่วมกันทุกพอร์ทัล (ลูกค้า/ไรเดอร์/ร้าน)
 * - enabled=false → ไม่ยิง API และไม่ subscribe อะไรเลย
 * - โหลดแชทจาก GET /api/orders/{orderId}/chat แล้ว subscribe ช่อง broadcast
 * - ถ้า subscribe ล้มเหลว → polling เงียบ ๆ ทุก 8 วินาที (ยังใช้งานได้เสมอ)
 */
export function useOrderChat(
  orderId: string | null | undefined,
  enabled: boolean,
  myUserId: string | null | undefined,
): UseOrderChatResult {
  const [session, setSession] = useState<OrderChatSession | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);

  const load = useCallback(async (): Promise<string | null> => {
    if (!orderId) return null;
    try {
      const d = await api<OrderChatData>(`/api/orders/${encodeURIComponent(orderId)}/chat`);
      setSession(d.session);
      setMessages(d.messages);
      setError('');
      return d.channel;
    } catch (e) {
      setError((e as Error).message);
      return null;
    }
  }, [orderId]);

  useEffect(() => {
    if (!enabled || !orderId) {
      setSession(null);
      setMessages([]);
      setError('');
      return;
    }
    let alive = true;
    let unsub: (() => void) | null = null;
    let poll: ReturnType<typeof setInterval> | null = null;

    const startPolling = () => {
      if (!poll) poll = setInterval(() => void load(), 8000);
    };
    const stopPolling = () => {
      if (poll) {
        clearInterval(poll);
        poll = null;
      }
    };

    void (async () => {
      setLoading(true);
      const channelName = await load();
      if (!alive) return;
      setLoading(false);
      if (!channelName) return; // เข้าถึงไม่ได้ — แสดง error จาก load
      try {
        const sub = subscribeChat(
          channelName,
          () => void load(), // สัญญาณไม่พกเนื้อหา — ดึงข้อความใหม่จาก API
          (status) => {
            if (!alive) return;
            if (status === 'SUBSCRIBED') stopPolling();
            else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') startPolling();
          },
        );
        unsub = sub.unsubscribe;
        startPolling(); // จ่ายความชัวร์: ใช้ polling จนกว่าจะ SUBSCRIBED ค่อยหยุด
      } catch {
        startPolling(); // realtime ใช้ไม่ได้ (env ขาด/สร้าง channel ไม่สำเร็จ) — polling สำรอง
      }
    })();

    return () => {
      alive = false;
      stopPolling();
      if (unsub) unsub();
    };
  }, [enabled, orderId, load]);

  const send = useCallback(
    async (content: string): Promise<boolean> => {
      if (!orderId) return false;
      setSending(true);
      try {
        const d = await api<{ ok: boolean; message: ChatMessage }>(
          `/api/orders/${encodeURIComponent(orderId)}/chat`,
          { method: 'POST', body: JSON.stringify({ content }) },
        );
        setMessages((prev) => (prev.some((m) => m.id === d.message.id) ? prev : [...prev, d.message]));
        setError('');
        return true;
      } catch (e) {
        setError((e as Error).message);
        return false;
      } finally {
        setSending(false);
      }
    },
    [orderId],
  );

  const isMine = useCallback(
    (m: ChatMessage) => m.sender_id != null && m.sender_id === myUserId,
    [myUserId],
  );

  return { session, messages, loading, error, sending, isMine, send };
}
