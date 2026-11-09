'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Check, Clock, Copy, Tag, TriangleAlert, Zap } from 'lucide-react';
import { api, baht } from '@/lib/client';

interface Promotion {
  id: string;
  code: string;
  type: string;
  value: number | null;
  min_order_amount: number | null;
  max_discount: number | null;
  name: string;
  description: string | null;
  expires_at: string | null;
  first_order_only: boolean | null;
  restaurant_id: string | null;
}

/**
 * จำนวนเงินทุกคอลัมน์ในตาราง promotions เป็นหน่วยสตางค์ตามมาตรฐานฐานข้อมูล
 * (เช่น min_order_amount 100000 = ฿1,000, max_discount 15000 = ฿150)
 * การแสดงผลใช้ baht() จาก lib/client ซึ่งรับสตางค์แล้วหาร 100 ให้เอง
 */

/** ป้ายส่วนลดใหญ่: percentage/percent → ลด x%, fixed → ลด ฿x, อื่น ๆ/free_shipping → ฟรีค่าส่ง */
function discountLabel(p: Promotion): string {
  if (p.type === 'percentage' || p.type === 'percent') return `ลด ${p.value ?? 0}%`;
  if (p.type === 'fixed') return `ลด ${baht(p.value ?? 0)}`;
  return 'ฟรีค่าส่ง';
}

function titleOf(p: Promotion): string {
  const name = (p.name ?? '').trim();
  return name !== '' ? name : 'โปรโมชั่นพิเศษ';
}

function minOrderLabel(p: Promotion): string {
  if (p.min_order_amount && p.min_order_amount > 0) return `ขั้นต่ำ ${baht(p.min_order_amount)}`;
  return 'ไม่มียอดสั่งขั้นต่ำ';
}

function expiryLabel(iso: string | null): string {
  if (!iso) return 'ไม่มีวันหมดอายุ';
  return `ใช้ได้ถึง ${new Date(iso).toLocaleDateString('th-TH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Bangkok',
  })}`;
}

/** ปุ่มคัดลอกโค้ด — คลิกแล้วเปลี่ยนเป็น Check "คัดลอกแล้ว" 1.5 วินาที */
function CopyCodeButton({ code, dark }: { code: string; dark: boolean }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* คลิปบอร์ดถูกบล็อก — ปล่อยเงียบ ๆ */
    }
  };

  return (
    <button
      type="button"
      onClick={() => void copy()}
      aria-label={copied ? 'คัดลอกโค้ดแล้ว' : `คัดลอกโค้ด ${code}`}
      className={`inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full px-4 text-xs font-bold transition-all active:scale-95 ${
        dark ? 'bg-[#FFC400] text-black' : 'bg-black text-[#FFC400]'
      }`}
    >
      {copied ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
      {copied ? 'คัดลอกแล้ว' : 'คัดลอกโค้ด'}
    </button>
  );
}

export default function OffersPage() {
  const [promos, setPromos] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // โหลดครั้งแรก — setState ทั้งหมดอยู่ใน async callback ไม่เรียก synchronous ใน effect body
  useEffect(() => {
    let cancelled = false;
    api<{ data: Promotion[] }>('/api/promotions')
      .then((r) => {
        if (!cancelled) setPromos(r.data);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // กดปุ่ม "ลองอีกครั้ง" (event handler — setState ได้ปกติ)
  const retry = useCallback(() => {
    setLoading(true);
    setError('');
    api<{ data: Promotion[] }>('/api/promotions')
      .then((r) => setPromos(r.data))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-5">
      <header className="pt-1">
        <h1 className="text-xl font-bold text-black">ข้อเสนอพิเศษและคูปอง</h1>
        <p className="text-sm text-neutral-400">เลือกโปรโมชั่น คัดลอกโค้ด แล้วใช้ตอนชำระเงิน</p>
      </header>

      {/* loading — การ์ดโปรโมชั่นโครงร่าง */}
      {loading && (
        <div className="space-y-4" aria-busy="true" aria-label="กำลังโหลดข้อเสนอ">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-44 animate-pulse rounded-3xl bg-neutral-100" />
          ))}
        </div>
      )}

      {/* error */}
      {!loading && error !== '' && (
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-red-50">
            <TriangleAlert className="h-8 w-8 text-red-400" aria-hidden />
          </span>
          <p className="text-sm text-red-500">{error}</p>
          <button type="button" onClick={retry} className="btn-brand inline-flex h-11 items-center px-8 text-sm">
            ลองอีกครั้ง
          </button>
        </div>
      )}

      {/* empty — ตามต้นแบบ Offers Are Available */}
      {!loading && error === '' && promos.length === 0 && (
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <span className="flex h-20 w-20 items-center justify-center rounded-full bg-[#FFF4CC]">
            <Tag className="h-9 w-9 text-black" aria-hidden />
          </span>
          <h2 className="text-lg font-bold text-black">ยังไม่มีข้อเสนอในขณะนี้</h2>
          <p className="text-sm text-neutral-400">กลับมาดูใหม่ภายหลัง หรือไปสั่งอาหารก่อนเลย</p>
          <Link href="/" className="btn-brand inline-flex h-11 items-center px-8 text-sm">
            ดูร้านทั้งหมด
          </Link>
        </div>
      )}

      {/* normal — การ์ดสลับพื้นดำ/เหลืองเหมือนหน้าแรก */}
      {!loading && error === '' && promos.length > 0 && (
        <ul className="space-y-4" aria-label="รายการโปรโมชั่น">
          {promos.map((p, index) => {
            const dark = index % 2 === 0;
            return (
              <li key={p.id}>
                <article
                  className={`relative overflow-hidden rounded-3xl p-5 ${
                    dark ? 'bg-black text-white' : 'bg-[#FFC400] text-black'
                  }`}
                >
                  <div className="relative flex items-start justify-between gap-4">
                    <div className="min-w-0 space-y-1.5">
                      <p className={`truncate-1 text-3xl font-extrabold leading-tight ${dark ? 'text-[#FFC400]' : 'text-black'}`}>
                        {discountLabel(p)}
                      </p>
                      <h2 className="truncate-1 text-base font-bold">{titleOf(p)}</h2>
                      {p.description && <p className="truncate-2 text-xs opacity-80">{p.description}</p>}
                      <p className="text-xs font-medium opacity-80">{minOrderLabel(p)}</p>
                      {(p.type === 'percentage' || p.type === 'percent') && p.max_discount != null && p.max_discount > 0 && (
                        <p className="text-xs font-medium opacity-80">ลดสูงสุด {baht(p.max_discount)}</p>
                      )}
                      {p.first_order_only && (
                        <span
                          className={`inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            dark ? 'bg-[#FFC400] text-black' : 'bg-black text-[#FFC400]'
                          }`}
                        >
                          <Zap className="h-3 w-3" aria-hidden />
                          ออเดอร์แรกเท่านั้น
                        </span>
                      )}
                    </div>
                    <span
                      className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full ${
                        dark ? 'bg-[#FFC400]/15 text-[#FFC400]' : 'bg-black/10 text-black'
                      }`}
                      aria-hidden
                    >
                      <Tag className="h-6 w-6" />
                    </span>
                  </div>

                  <div
                    className={`my-4 border-t border-dashed ${dark ? 'border-white/20' : 'border-black/20'}`}
                    aria-hidden
                  />

                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span
                      className={`truncate-1 rounded-full px-3 py-2 text-xs font-bold tracking-widest ${
                        dark ? 'bg-white/10 text-white' : 'bg-black/10 text-black'
                      }`}
                    >
                      โค้ด {p.code}
                    </span>
                    <CopyCodeButton code={p.code} dark={dark} />
                  </div>

                  <p className="mt-3 flex items-center gap-1.5 text-[11px] opacity-70">
                    <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    {expiryLabel(p.expires_at)}
                  </p>

                  <span
                    className="pointer-events-none absolute -bottom-10 -right-10 h-28 w-28 rounded-full opacity-10"
                    style={{ background: dark ? '#FFC400' : '#ffffff' }}
                    aria-hidden
                  />
                </article>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
