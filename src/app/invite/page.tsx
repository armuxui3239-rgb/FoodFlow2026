'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import {
  ArrowLeft,
  Check,
  Copy,
  Gift,
  Mail,
  MessageCircle,
  Send,
  Users,
  Zap,
} from 'lucide-react';
import { api, useSession } from '@/lib/client';

interface ReferralData {
  code: string;
  createdAt: string;
  invitedCount: number;
}

/** ข้อความเชิญเพื่อน (ภาษาไทย) */
function inviteMessage(code: string): string {
  return `สั่งอาหารผ่านฟู๊ด ธันเดอร์ ใช้โค้ดของฉัน ${code} รับส่วนลดเปิดตัว!`;
}

/** คั่นตัวอักษรโค้ดด้วยช่องว่าง เช่น FT3X9AB → F T 3 X 9 A B */
function spaced(code: string): string {
  return code.split('').join(' ');
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export default function InvitePage() {
  const { user, ready: sessionReady } = useSession();
  const [referral, setReferral] = useState<ReferralData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copiedField, setCopiedField] = useState<'code' | 'message' | null>(null);
  const [copyError, setCopyError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const r = await api<{ data: ReferralData }>('/api/referral');
      setReferral(r.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'โหลดโค้ดเชิญไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!sessionReady || !user) return;
    void load();
  }, [sessionReady, user, load]);

  const handleCopy = async (field: 'code' | 'message') => {
    if (!referral) return;
    const text = field === 'code' ? referral.code : inviteMessage(referral.code);
    const ok = await copyText(text);
    if (ok) {
      setCopyError('');
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } else {
      setCopyError('คัดลอกไม่สำเร็จ กรุณาคัดลอกด้วยตนเอง');
    }
  };

  // สถานะ loading — รอเซสชันและข้อมูลโค้ดเชิญ
  if (!sessionReady || (user && loading && !error)) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="กำลังโหลดหน้าเชิญเพื่อน">
        <div className="h-10 w-10 animate-pulse rounded-full bg-neutral-100" />
        <div className="h-56 animate-pulse rounded-3xl bg-neutral-100" />
        <div className="h-12 animate-pulse rounded-full bg-neutral-100" />
        <div className="h-12 animate-pulse rounded-full bg-neutral-100" />
      </div>
    );
  }

  // สถานะ error — โหลดโค้ดเชิญไม่สำเร็จ
  if (error) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-red-50">
          <Gift className="h-8 w-8 text-red-400" aria-hidden />
        </span>
        <p className="text-sm text-red-500">{error}</p>
        <button onClick={() => void load()} className="btn-brand h-11 rounded-full px-6 text-sm">
          ลองอีกครั้ง
        </button>
      </div>
    );
  }

  // สถานะ empty (ยังไม่เข้าสู่ระบบ)
  if (!user) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <span className="flex h-20 w-20 items-center justify-center rounded-full bg-neutral-100">
          <Zap className="h-9 w-9 text-[#FFC400]" aria-hidden />
        </span>
        <h1 className="text-lg font-bold text-black">เข้าสู่ระบบเพื่อรับโค้ดเชิญ</h1>
        <p className="text-sm text-neutral-400">เชิญเพื่อนมาสั่งอาหารและรับส่วนลดไปด้วยกัน</p>
        <Link href="/login?next=%2Finvite" className="btn-brand inline-flex h-12 items-center px-8 text-sm">
          เข้าสู่ระบบ
        </Link>
      </div>
    );
  }

  const code = referral?.code ?? '';
  const disabledShare =
    'flex h-20 flex-col items-center justify-center gap-1 rounded-2xl border border-line bg-white text-neutral-300';

  return (
    <div className="space-y-5">
      <header className="flex items-center gap-3 pt-1">
        <Link
          href="/profile"
          aria-label="ย้อนกลับไปหน้าโปรไฟล์"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-line bg-white transition-colors hover:bg-[#FFF4CC]"
        >
          <ArrowLeft className="h-4 w-4 text-black" aria-hidden />
        </Link>
        <h1 className="text-lg font-bold text-black">เชิญเพื่อนรับส่วนลด</h1>
      </header>

      {/* การ์ดโค้ดของฉัน — พื้นดำ โค้ดตัวใหญ่สีเหลือง */}
      <section
        aria-label="โค้ดเชิญของฉัน"
        className="rounded-3xl bg-black px-6 py-8 text-center"
      >
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[11px] font-bold text-[#FFC400]">
          <Gift className="h-3.5 w-3.5" aria-hidden />
          โค้ดเชิญของคุณ
        </span>
        <p
          data-testid="referral-code"
          aria-label={`โค้ดเชิญ ${code}`}
          className="mt-4 break-all text-3xl font-bold tracking-widest text-[#FFC400]"
        >
          {spaced(code)}
        </p>
        <button
          type="button"
          data-testid="copy-code"
          onClick={() => void handleCopy('code')}
          className="btn-brand mt-5 inline-flex h-11 items-center gap-2 px-6 text-sm"
        >
          {copiedField === 'code' ? (
            <>
              <Check className="h-4 w-4" aria-hidden />
              คัดลอกแล้ว
            </>
          ) : (
            <>
              <Copy className="h-4 w-4" aria-hidden />
              คัดลอกโค้ด
            </>
          )}
        </button>
      </section>

      {/* คัดลอกข้อความเชิญ */}
      <button
        type="button"
        data-testid="copy-invite-message"
        onClick={() => void handleCopy('message')}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-full border border-line bg-white text-sm font-semibold text-black transition-colors hover:bg-[#FFF4CC]"
      >
        {copiedField === 'message' ? (
          <>
            <Check className="h-4 w-4" aria-hidden />
            คัดลอกข้อความเชิญแล้ว
          </>
        ) : (
          <>
            <Copy className="h-4 w-4" aria-hidden />
            คัดลอกข้อความเชิญ
          </>
        )}
      </button>
      {copyError && (
        <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-500">
          {copyError}
        </p>
      )}

      {/* แชร์ผ่านช่องทางอื่น — ยังไม่เปิดใช้งาน (ห้ามลิงก์จริงออกภายนอก) */}
      <section aria-label="แชร์ผ่านช่องทางอื่น" className="space-y-2">
        <h2 className="text-sm font-bold text-black">แชร์ผ่านช่องทางอื่น</h2>
        <div className="grid grid-cols-3 gap-3">
          <button type="button" disabled data-testid="share-message" className={disabledShare}>
            <MessageCircle className="h-5 w-5" aria-hidden />
            <span className="text-[11px] font-semibold">ข้อความ</span>
            <span className="text-[9px]">ยังไม่เปิดใช้งาน</span>
          </button>
          <button type="button" disabled data-testid="share-send" className={disabledShare}>
            <Send className="h-5 w-5" aria-hidden />
            <span className="text-[11px] font-semibold">ส่งให้เพื่อน</span>
            <span className="text-[9px]">ยังไม่เปิดใช้งาน</span>
          </button>
          <button type="button" disabled data-testid="share-mail" className={disabledShare}>
            <Mail className="h-5 w-5" aria-hidden />
            <span className="text-[11px] font-semibold">อีเมล</span>
            <span className="text-[9px]">ยังไม่เปิดใช้งาน</span>
          </button>
        </div>
      </section>

      {/* เพื่อนที่ใช้โค้ดของคุณ — สถานะ empty */}
      <section aria-label="เพื่อนที่ใช้โค้ดของคุณ" className="space-y-2">
        <h2 className="text-sm font-bold text-black">เพื่อนที่ใช้โค้ดของคุณ</h2>
        <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-line bg-white py-12 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-neutral-100">
            <Users className="h-8 w-8 text-neutral-300" aria-hidden />
          </span>
          <p className="text-sm text-neutral-400">ยังไม่มีเพื่อนที่ใช้โค้ดของคุณ</p>
          <p className="px-8 text-xs text-neutral-400">
            แชร์โค้ดให้เพื่อนของคุณ เมื่อเพื่อนสั่งซื้อครั้งแรกสำเร็จ รายชื่อจะแสดงที่นี่
          </p>
        </div>
      </section>
    </div>
  );
}
