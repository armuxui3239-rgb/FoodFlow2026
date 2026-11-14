'use client';

import { Suspense, useEffect, useRef } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Mic, MicOff, PhoneOff, UserRound, Video, VideoOff } from 'lucide-react';
import { useSession } from '@/lib/client';
import { CALL_STATUS_TH, useCall, type CallStatus } from '@/lib/calls';

/**
 * หน้าสายโทร (จบในระบบ) — สื่อเสียง/ภาพวิ่ง P2P ผ่าน WebRTC ล้วน ๆ ไม่มีเซิร์ฟเวอร์กลาง
 * - ผู้โทรเข้าพร้อม ?initiate=1 → ขอสื่อ สร้าง offer
 * - ผู้รับเข้าหลังกดรับกริ่ง (ไม่มี initiate) → รอ offer แล้วตอบ answer
 * สัญญาณ SDP/ICE เดินทางผ่าน Supabase Broadcast บนช่อง calls:{orderId}:{hmac16} เท่านั้น
 */

const ROLE_TH: Record<string, string> = {
  customer: 'ลูกค้า',
  driver: 'ไรเดอร์',
  admin: 'แอดมิน',
  restaurant: 'ร้าน',
};

const TERMINAL: CallStatus[] = ['ended', 'failed', 'rejected', 'missed', 'permission-error'];

function CallScreenInner() {
  const params = useParams<{ room: string }>();
  const sp = useSearchParams();
  const router = useRouter();
  const { user, refresh } = useSession();
  const room = params.room ?? '';
  const orderId = sp.get('order') ?? '';
  const initiate = sp.get('initiate') === '1';

  useEffect(() => {
    void refresh(); // กันเข้าหน้านี้ตรง ๆ แล้ว session ยังไม่โหลด
  }, [refresh]);

  const call = useCall({ room, initiate, video: true });

  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = call.remoteStream;
  }, [call.remoteStream]);
  useEffect(() => {
    if (localVideoRef.current) localVideoRef.current.srcObject = call.localStream;
  }, [call.localStream]);

  const hasCam = !!call.localStream && call.localStream.getVideoTracks().length > 0;
  const finished = TERMINAL.includes(call.status);
  const backHref = orderId ? `/orders/${encodeURIComponent(orderId)}` : '/';

  return (
    <div className="relative flex min-h-screen flex-col bg-neutral-950 text-white">
      {/* แถบบน: บริบทของสาย */}
      <header className="flex items-center justify-between gap-2 px-4 py-3">
        <span className="flex items-center gap-1.5 rounded-full bg-neutral-800 px-3 py-1.5 text-xs font-bold">
          <UserRound className="h-3.5 w-3.5" aria-hidden />
          {user ? `${user.fullName} · ${ROLE_TH[user.role] ?? user.role}` : 'กำลังโหลด...'}
        </span>
        {orderId && <span className="truncate-1 rounded-full bg-neutral-800 px-3 py-1.5 text-xs text-neutral-300">ออเดอร์ #{orderId.slice(0, 8)}</span>}
      </header>

      {/* วิดีโอคู่สาย */}
      <main className="relative mx-auto flex w-full max-w-3xl flex-1 items-center justify-center px-4">
        <div className="relative aspect-[3/4] max-h-[70vh] w-full overflow-hidden rounded-3xl bg-neutral-900">
          {call.remoteStream && (
            <video ref={remoteVideoRef} autoPlay playsInline className="h-full w-full object-cover" />
          )}
          {!call.remoteStream && (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-neutral-500">
              <span className="flex h-24 w-24 items-center justify-center rounded-full bg-neutral-800">
                <UserRound className={`h-12 w-12 ${call.status === 'connected' ? '' : 'animate-pulse'}`} aria-hidden />
              </span>
              <p className="text-sm font-bold text-neutral-300">{CALL_STATUS_TH[call.status]}</p>
              {call.error && <p className="max-w-xs px-4 text-center text-xs text-red-400">{call.error}</p>}
            </div>
          )}
          {/* มุมมองตัวเอง (พรีวิวเล็ก) */}
          {call.localStream && hasCam && (
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="absolute bottom-3 right-3 h-28 w-20 rounded-2xl border border-neutral-700 object-cover shadow-lg sm:h-36 sm:w-24"
            />
          )}
        </div>
      </main>

      {/* ปุ่มควบคุม */}
      {!finished && (
        <footer className="mx-auto flex w-full max-w-3xl items-center justify-center gap-3 px-4 py-5">
          <button
            type="button"
            onClick={call.toggleMute}
            aria-label={call.muted ? 'เปิดไมโครโฟน' : 'ปิดไมโครโฟน'}
            className={`flex h-14 w-14 items-center justify-center rounded-full transition-colors ${call.muted ? 'bg-white text-black' : 'bg-neutral-800 text-white hover:bg-neutral-700'}`}
          >
            {call.muted ? <MicOff className="h-6 w-6" aria-hidden /> : <Mic className="h-6 w-6" aria-hidden />}
          </button>
          <button
            type="button"
            onClick={call.toggleCam}
            disabled={!hasCam}
            aria-label={call.camOff ? 'เปิดกล้อง' : 'ปิดกล้อง'}
            className={`flex h-14 w-14 items-center justify-center rounded-full transition-colors disabled:opacity-40 ${call.camOff ? 'bg-white text-black' : 'bg-neutral-800 text-white hover:bg-neutral-700'}`}
          >
            {call.camOff ? <VideoOff className="h-6 w-6" aria-hidden /> : <Video className="h-6 w-6" aria-hidden />}
          </button>
          <button
            type="button"
            onClick={call.hangup}
            aria-label="วางสาย"
            className="flex h-14 w-14 items-center justify-center rounded-full bg-red-500 text-white transition-colors hover:bg-red-600"
          >
            <PhoneOff className="h-6 w-6" aria-hidden />
          </button>
        </footer>
      )}

      {/* จบสายแล้ว — สรุปสถานะ + ปุ่มกลับ */}
      {finished && (
        <footer className="mx-auto w-full max-w-sm space-y-3 px-4 py-6 text-center">
          <p className="text-base font-bold">{CALL_STATUS_TH[call.status]}</p>
          {call.status === 'permission-error' && call.error && (
            <p className="text-xs text-red-400">{call.error}</p>
          )}
          <div className="flex gap-2">
            {orderId ? (
              <a href={backHref} className="btn-brand flex h-12 flex-1 items-center justify-center gap-1.5 text-sm">
                <ArrowLeft className="h-4 w-4" aria-hidden /> กลับไปออเดอร์
              </a>
            ) : (
              <button type="button" onClick={() => router.back()} className="btn-brand h-12 flex-1 text-sm">
                <ArrowLeft className="mr-1.5 inline h-4 w-4" aria-hidden /> ย้อนกลับ
              </button>
            )}
          </div>
        </footer>
      )}

      {/* หมายเหตุตรงไปตรงมา */}
      <p className="px-6 pb-4 text-center text-[11px] leading-relaxed text-neutral-500">
        โทรตรงระหว่างผู้ใช้ภายในระบบ — ไม่มีเซิร์ฟเวอร์กลาง: เครือข่าย NAT เข้มอาจเชื่อมต่อไม่ได้
      </p>
    </div>
  );
}

export default function CallScreenPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-neutral-950" />}>
      <CallScreenInner />
    </Suspense>
  );
}
