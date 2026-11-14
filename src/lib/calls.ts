'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { api } from '@/lib/client';
import { createRealtimeClient } from '@/lib/realtime';

/**
 * ระบบโทรจบในระบบ (in-system call) — นโยบาย: ไม่พึ่งบริการภายนอกทั้งหมด
 * - สื่อเสียง/ภาพวิ่ง P2P ผ่าน WebRTC ของเบราว์เซอร์ (ไม่มี LiveKit ไม่มี TURN/STUN)
 * - สัญญาณ SDP/ICE ระหว่างสองฝ่ายใช้ Supabase Broadcast บนช่องชื่อคาดเดาไม่ได้
 *   (calls:{orderId}:{hmac16}) และกริ่งส่วนตัว ring:{userId}:{hmac16}
 *   ที่ API คืนเฉพาะผู้ร่วมออเดอร์ที่ยืนยันแล้วเท่านั้น
 */

export interface IncomingCall {
  room: string;
  orderCode: string;
  fromName: string;
  orderId: string;
}

export type CallStatus =
  | 'dialing'
  | 'ringing'
  | 'connecting'
  | 'connected'
  | 'ended'
  | 'failed'
  | 'rejected'
  | 'missed'
  | 'permission-error';

/** ข้อความสถานะภาษาไทยสำหรับหน้าโทร */
export const CALL_STATUS_TH: Record<CallStatus, string> = {
  dialing: 'กำลังเรียก...',
  ringing: 'สายเรียกเข้า',
  connecting: 'กำลังเชื่อมต่อ',
  connected: 'เชื่อมต่อแล้ว',
  ended: 'จบสาย',
  failed: 'ไม่สำเร็จ — เครือข่ายอาจบล็อก P2P',
  rejected: 'คู่สายปฏิเสธสาย',
  missed: 'ไม่มีผู้รับสาย',
  'permission-error': 'ไม่ได้รับสิทธิ์ไมโครโฟน/กล้อง',
};

/** (a) สร้างการเชื่อมต่อ WebRTC — iceServers: [] เพราะโทรจบในระบบ ไม่มีเซิร์ฟเวอร์ TURN/STUN ภายนอก */
export function createCallConnection(): RTCPeerConnection {
  return new RTCPeerConnection({ iceServers: [] });
}

/** (b) ขอสิทธิ์ไมค์ (+กล้องถ้าต้องการ) — ถ้ากล้องไม่ได้ลองเหลือแค่เสียง; ไม่ได้เลย throw ข้อความไทยเข้าใจง่าย */
export async function getUserMediaSafe(video: boolean): Promise<MediaStream> {
  const tryGet = (v: boolean) =>
    navigator.mediaDevices.getUserMedia({
      audio: true,
      video: v ? { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } } : false,
    });
  try {
    return await tryGet(video);
  } catch (err) {
    if (video) {
      try {
        return await tryGet(false); // กล้องไม่ได้ — ใช้เสียงอย่างเดียวยังไปต่อได้
      } catch {
        /* ไม่ได้ทั้งคู่ — เด้งข้อความด้านล่าง */
      }
    }
    const name = (err as DOMException)?.name ?? '';
    if (name === 'NotAllowedError' || name === 'SecurityError') {
      throw new Error('ไม่ได้รับอนุญาตให้ใช้ไมโครโฟน/กล้อง — กดอนุญาตในเบราว์เซอร์แล้วลองอีกครั้ง');
    }
    if (name === 'NotFoundError' || name === 'NotReadableError' || name === 'OverconstrainedError') {
      throw new Error('ไม่พบไมโครโฟน/กล้องที่ใช้งานได้บนอุปกรณ์นี้');
    }
    throw new Error('เปิดไมโครโฟน/กล้องไม่สำเร็จ — อุปกรณ์อาจถูกแอปอื่นใช้งานอยู่');
  }
}

/** (c) ฟังกริ่งส่วนตัว — ขอชื่อช่อง ring จาก /api/calls/ring (เซิร์ฟเวอร์ตรวจสิทธิ์ + คำนวณ HMAC เอง) แล้ว subscribe */
export async function subscribeRing(
  onIncoming: (call: IncomingCall) => void,
  onStatus?: (status: string) => void,
): Promise<{ ringChannel: string; unsubscribe: () => void }> {
  const { ringChannel } = await api<{ ringChannel: string; userName: string }>('/api/calls/ring');
  let ch: RealtimeChannel | null = null;
  try {
    ch = createRealtimeClient().channel(ringChannel);
    ch.on<IncomingCall>('broadcast', { event: 'incoming-call' }, (msg) => {
      const p = msg?.payload;
      if (p && typeof p === 'object' && typeof p.room === 'string' && typeof p.orderCode === 'string') {
        onIncoming(p);
      }
    });
    ch.subscribe((status) => onStatus?.(status));
  } catch {
    onStatus?.('CHANNEL_ERROR');
  }
  return {
    ringChannel,
    unsubscribe: () => {
      if (ch) void createRealtimeClient().removeChannel(ch);
    },
  };
}

export interface SdpSignal {
  type: 'offer' | 'answer';
  sdp: string;
}
export interface IceSignal {
  candidate: RTCIceCandidateInit | null;
}

export interface CallChannelHandlers {
  onSdp?: (s: SdpSignal) => void;
  onIce?: (s: IceSignal) => void;
  onHangup?: () => void;
  onRejected?: () => void;
  onStatus?: (status: string) => void;
}

/** (d) ฟังช่องห้องโทร — event 'sdp'/'ice'/'hangup'/'rejected' + ผู้ส่งสัญญาณบนช่องเดียวกัน */
export function subscribeCallChannel(room: string, h: CallChannelHandlers) {
  const ch = createRealtimeClient().channel(room);
  ch.on<SdpSignal>('broadcast', { event: 'sdp' }, (msg) => {
    const p = msg?.payload;
    if (p && (p.type === 'offer' || p.type === 'answer') && typeof p.sdp === 'string') h.onSdp?.(p);
  });
  ch.on<IceSignal>('broadcast', { event: 'ice' }, (msg) => {
    const p = msg?.payload;
    if (p && typeof p === 'object' && 'candidate' in p) h.onIce?.(p);
  });
  ch.on<{ type: string }>('broadcast', { event: 'hangup' }, () => h.onHangup?.());
  ch.on<{ type: string }>('broadcast', { event: 'rejected' }, () => h.onRejected?.());
  ch.subscribe((status) => h.onStatus?.(status));
  return {
    send: (event: string, payload: Record<string, unknown>) => {
      void ch.send({ type: 'broadcast', event, payload }).catch(() => undefined);
    },
    unsubscribe: () => {
      void createRealtimeClient().removeChannel(ch);
    },
  };
}

/** ปฏิเสธสายจากนอกหน้าโทร (พอร์ทัลไรเดอร์/หน้าออเดอร์) — เปิดช่องห้องชั่วคราว ส่ง 'rejected' แล้วปิด */
export async function sendRejectedToRoom(room: string): Promise<void> {
  const ch = createRealtimeClient().channel(room);
  try {
    await new Promise<void>((resolve) => {
      const t = setTimeout(resolve, 3000); // subscribe ไม่ทันก็ปล่อยไป — best-effort
      ch.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          clearTimeout(t);
          resolve();
        }
      });
    });
    await ch.send({ type: 'broadcast', event: 'rejected', payload: { type: 'rejected' } });
    await new Promise((r) => setTimeout(r, 200)); // รอแพ็กเกจออกก่อนปิดช่อง
  } catch {
    /* best-effort */
  }
  try {
    await createRealtimeClient().removeChannel(ch);
  } catch {
    /* ไม่สนใจ */
  }
}

/** ฮุคฟังกริ่ง — คืนสายเรียกเข้า (null = ไม่มี) พร้อม auto-dismiss 60 วิ (ชื่อช่องหมดอายุใน 2 นาที) */
export function useIncomingRing(enabled = true): IncomingCall | null {
  const [incoming, setIncoming] = useState<IncomingCall | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    let unsub: (() => void) | null = null;
    subscribeRing((call) => {
      if (alive) setIncoming(call);
    })
      .then((sub) => {
        if (!alive) sub.unsubscribe();
        else unsub = sub.unsubscribe;
      })
      .catch(() => undefined); // ยังไม่ล็อกอิน/env ขาด — ไม่มีกริ่งก็ไม่พังหน้า
    return () => {
      alive = false;
      unsub?.();
    };
  }, [enabled]);
  useEffect(() => {
    if (!incoming) return;
    const t = setTimeout(() => setIncoming(null), 60000);
    return () => clearTimeout(t);
  }, [incoming]);
  return incoming;
}

export interface UseCallOptions {
  room: string;
  /** true = ผู้โทร (สร้าง offer เมื่อสื่อ+ช่องพร้อม), false = ผู้รับ (รอ offer แล้วตอบ answer) */
  initiate: boolean;
  video: boolean;
}

export interface UseCallResult {
  status: CallStatus;
  remoteStream: MediaStream | null;
  localStream: MediaStream | null;
  connectionState: RTCPeerConnectionState | 'new';
  muted: boolean;
  camOff: boolean;
  error: string;
  toggleMute: () => void;
  toggleCam: () => void;
  hangup: () => void;
}

/** (e) ฮุคครบวงจร: สื่อ → offer/answer → ICE trickle → สื่อคู่สาย → วางสาย (เก็บกวาดครบตอน unmount) */
export function useCall({ room, initiate, video }: UseCallOptions): UseCallResult {
  const [status, setStatus] = useState<CallStatus>(initiate ? 'dialing' : 'ringing');
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [connectionState, setConnectionState] = useState<RTCPeerConnectionState | 'new'>('new');
  const [muted, setMuted] = useState(false);
  const [camOff, setCamOff] = useState(false);
  const [error, setError] = useState('');

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const chanRef = useRef<{ send: (event: string, payload: Record<string, unknown>) => void; unsubscribe: () => void } | null>(null);
  const localRef = useRef<MediaStream | null>(null);
  const iceQueueRef = useRef<RTCIceCandidateInit[]>([]);
  const remoteSetRef = useRef(false);
  const endedRef = useRef(false);
  const offeredRef = useRef(false);
  const connectedRef = useRef(false);
  const hangupRef = useRef<() => void>(() => undefined);

  useEffect(() => {
    endedRef.current = false;
    offeredRef.current = false;
    connectedRef.current = false;
    remoteSetRef.current = false;
    iceQueueRef.current = [];
    setStatus(initiate ? 'dialing' : 'ringing');
    setError('');
    setRemoteStream(null);
    setLocalStream(null);
    setMuted(false);
    setCamOff(false);
    let alive = true;
    let missedTimer: ReturnType<typeof setTimeout> | null = null;

    const teardown = () => {
      localRef.current?.getTracks().forEach((t) => t.stop()); // ปิดไมค์/กล้อง
      localRef.current = null;
      setLocalStream(null);
      const pc = pcRef.current;
      if (pc) {
        pc.onicecandidate = null;
        pc.ontrack = null;
        pc.onconnectionstatechange = null;
        pc.close();
        pcRef.current = null;
      }
      chanRef.current?.unsubscribe(); // ยกเลิกช่อง broadcast
      chanRef.current = null;
      setRemoteStream(null);
    };

    const end = (s: CallStatus) => {
      if (endedRef.current) return;
      endedRef.current = true;
      if (missedTimer) clearTimeout(missedTimer);
      teardown();
      setStatus(s);
    };

    hangupRef.current = () => {
      chanRef.current?.send('hangup', { type: 'hangup' }); // แจ้งคู่สายก่อนเก็บกวาด
      end('ended');
    };

    const drainIce = async () => {
      const pc = pcRef.current;
      if (!pc) return;
      const q = iceQueueRef.current;
      iceQueueRef.current = [];
      for (const c of q) {
        try {
          await pc.addIceCandidate(c);
        } catch {
          /* candidate เก่า — ข้าม */
        }
      }
    };

    const onSdp = async (msg: SdpSignal) => {
      const pc = pcRef.current;
      if (!pc || endedRef.current || !alive) return;
      try {
        if (msg.type === 'offer') {
          await pc.setRemoteDescription({ type: 'offer', sdp: msg.sdp });
          remoteSetRef.current = true;
          await drainIce();
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          chanRef.current?.send('sdp', { type: 'answer', sdp: pc.localDescription?.sdp ?? '' });
          setStatus('connecting');
        } else {
          await pc.setRemoteDescription({ type: 'answer', sdp: msg.sdp });
          remoteSetRef.current = true;
          await drainIce();
          setStatus('connecting');
        }
      } catch (e) {
        console.warn('จัดการ SDP ไม่สำเร็จ:', e);
      }
    };

    const onIce = async (msg: IceSignal) => {
      const pc = pcRef.current;
      if (!pc || endedRef.current || !alive || !msg.candidate) return;
      if (!remoteSetRef.current) {
        iceQueueRef.current.push(msg.candidate); // ICE มาก่อน remote description — คิวไว้ก่อน
        return;
      }
      try {
        await pc.addIceCandidate(msg.candidate);
      } catch {
        /* candidate เก่า — ข้าม */
      }
    };

    const maybeOffer = async () => {
      if (!initiate || endedRef.current || !alive || offeredRef.current) return;
      if (!localRef.current || !chanRef.current || !pcRef.current) return;
      offeredRef.current = true;
      try {
        const offer = await pcRef.current.createOffer();
        await pcRef.current.setLocalDescription(offer);
        chanRef.current.send('sdp', { type: 'offer', sdp: pcRef.current.localDescription?.sdp ?? '' });
      } catch (e) {
        console.warn('สร้าง offer ไม่สำเร็จ:', e);
        end('failed');
      }
    };

    void (async () => {
      try {
        const stream = await getUserMediaSafe(video);
        if (!alive || endedRef.current) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        localRef.current = stream;
        setLocalStream(stream);
        setCamOff(stream.getVideoTracks().length === 0);
      } catch (e) {
        if (!alive) return;
        setError((e as Error).message);
        end('permission-error');
        return;
      }
      const pc = createCallConnection();
      pcRef.current = pc;
      const local = localRef.current;
      if (local) local.getTracks().forEach((t) => pc.addTrack(t, local));
      pc.onicecandidate = (ev) => {
        chanRef.current?.send('ice', { candidate: ev.candidate ? ev.candidate.toJSON() : null });
      };
      pc.ontrack = (ev) => {
        if (ev.streams[0]) setRemoteStream(ev.streams[0]);
      };
      pc.onconnectionstatechange = () => {
        if (!alive || endedRef.current || pcRef.current !== pc) return;
        setConnectionState(pc.connectionState);
        if (pc.connectionState === 'connected') {
          connectedRef.current = true;
          setStatus('connected');
          if (missedTimer) clearTimeout(missedTimer);
        } else if (pc.connectionState === 'failed') {
          end('failed'); // ส่วนใหญ่คือ NAT เข้มบล็อก P2P (ไม่มี TURN)
        } else if (pc.connectionState === 'disconnected') {
          setStatus('connecting');
        }
      };
      chanRef.current = subscribeCallChannel(room, {
        onSdp: (m) => void onSdp(m),
        onIce: (m) => void onIce(m),
        onHangup: () => end('ended'),
        onRejected: () => end('rejected'),
        onStatus: (st) => {
          if (!alive || endedRef.current) return;
          if (st === 'SUBSCRIBED') void maybeOffer();
          else if (st === 'CHANNEL_ERROR' || st === 'TIMED_OUT' || st === 'CLOSED') end('failed');
        },
      });
      // ผู้โทร: สื่อ+ช่องพร้อม → ยิง offer / ทั้งคู่: ตั้งเวลาจับ "ไม่มีผู้รับสาย"
      void maybeOffer();
      missedTimer = setTimeout(() => {
        if (!connectedRef.current && !endedRef.current) end('missed');
      }, 60000);
    })();

    return () => {
      alive = false;
      endedRef.current = true;
      if (missedTimer) clearTimeout(missedTimer);
      teardown();
    };
  }, [room, initiate, video]);

  const toggleMute = useCallback(() => {
    setMuted((m) => {
      const next = !m;
      localRef.current?.getAudioTracks().forEach((t) => (t.enabled = !next));
      return next;
    });
  }, []);

  const toggleCam = useCallback(() => {
    setCamOff((off) => {
      const next = !off;
      localRef.current?.getVideoTracks().forEach((t) => (t.enabled = !next));
      return next;
    });
  }, []);

  const hangup = useCallback(() => hangupRef.current(), []);

  return { status, remoteStream, localStream, connectionState, muted, camOff, error, toggleMute, toggleCam, hangup };
}
