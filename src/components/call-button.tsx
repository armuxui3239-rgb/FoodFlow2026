'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Phone, PhoneOff } from 'lucide-react';
import { api } from '@/lib/client';

/**
 * ปุ่มโทรเสียง/วิดีโอ — ระบบโทรจบในระบบ (in-system call)
 * สื่อวิ่ง P2P ผ่าน WebRTC ของเบราว์เซอร์ (ไม่มีเซิร์ฟเวอร์สื่อภายนอก)
 * สัญญาณใช้ Supabase Broadcast บนช่องคาดเดาไม่ได้ที่ /api/calls/token แจกให้ผู้ร่วมออเดอร์เท่านั้น
 * ปิดด้วย feature flag NEXT_PUBLIC_CALLS_ENABLED — ปิดอยู่จะแสดงสถานะ "ยังไม่เปิดใช้งาน" เสมอ
 */
const CALLS_ENABLED = process.env.NEXT_PUBLIC_CALLS_ENABLED === 'true';

export function CallButton({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  const startCall = async () => {
    setNotice(null);
    setStarting(true);
    try {
      const res = await api<{ ok: boolean; room: string }>(
        `/api/calls/token?order=${encodeURIComponent(orderId)}`,
        { method: 'POST' },
      );
      // เปิดในแท็บเดิม — อยู่ในแอปต่อ (หน้าสายจะ subscribe ช่องห้องแล้วยิง offer เอง)
      router.push(`/calls/${encodeURIComponent(res.room)}?order=${encodeURIComponent(orderId)}&initiate=1`);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'เรียกไม่สำเร็จ');
    } finally {
      setStarting(false);
    }
  };

  if (!CALLS_ENABLED) {
    return (
      <>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 rounded-full border border-line bg-neutral-50 px-4 py-2.5 text-sm font-medium text-ink-soft"
          aria-label="โทรผู้จัดส่ง (ยังไม่เปิดใช้งาน)"
        >
          <PhoneOff className="h-4 w-4" aria-hidden />
          โทรเสียง/วิดีโอ
        </button>
        {open && (
          <div
            role="dialog"
            aria-modal="true"
            aria-label="ฟีเจอร์โทรยังไม่เปิดใช้งาน"
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
            onClick={() => setOpen(false)}
          >
            <div
              className="w-full max-w-sm rounded-3xl bg-white p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="mb-2 text-base font-bold text-ink">ยังไม่เปิดใช้งาน</h2>
              <p className="text-sm text-ink-soft">
                ฟีเจอร์โทรเสียง/วิดีโอจะเปิดให้ใช้เมื่อระบบมีเซิร์ฟเวอร์สื่อ (LiveKit) รองรับ
                ในขณะนี้ยังไม่พร้อมใช้งาน — ติดต่อผู้จัดส่งได้ทางหมายเลขในใบเสร็จ
              </p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="mt-4 w-full rounded-full bg-brand py-3 text-sm font-bold text-black"
              >
                เข้าใจแล้ว
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => void startCall()}
        disabled={starting}
        className="flex items-center gap-2 rounded-full bg-brand px-4 py-2.5 text-sm font-bold text-black transition hover:bg-brand-strong disabled:opacity-50"
      >
        <Phone className="h-4 w-4" aria-hidden />
        {starting ? 'กำลังเรียก...' : 'โทรเสียง/วิดีโอ'}
      </button>
      {notice && (
        <p role="alert" className="mt-2 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">
          {notice}
        </p>
      )}
    </>
  );
}
