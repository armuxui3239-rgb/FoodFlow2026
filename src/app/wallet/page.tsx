'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  ArrowDownCircle,
  ArrowUpCircle,
  CircleHelp,
  Plus,
  Wallet,
  Zap,
} from 'lucide-react';
import { api, baht, useSession } from '@/lib/client';

interface WalletTx {
  id: string;
  amount_delta: number;
  type: string;
  reason: string | null;
  ref_id: string | null;
  created_at: string;
  status: string;
}

const TX_STATUS_TH: Record<string, string> = {
  pending: 'รอดำเนินการ',
  completed: 'สำเร็จ',
  failed: 'ไม่สำเร็จ',
  cancelled: 'ยกเลิก',
  refunded: 'คืนเงินแล้ว',
};

function txStatusClass(status: string): string {
  if (status === 'completed') return 'bg-black text-white';
  if (status === 'pending') return 'bg-[#FFC400] text-black';
  return 'bg-red-50 text-red-600';
}

export default function WalletPage() {
  const { user, ready: sessionReady } = useSession();
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState<WalletTx[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!sessionReady || !user) return;
    let cancelled = false;
    api<{ data: { balance: number; transactions: WalletTx[] } }>('/api/wallet')
      .then((r) => {
        if (!cancelled) {
          setBalance(r.data.balance);
          setTransactions(r.data.transactions);
        }
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
  }, [user, sessionReady]);

  // สถานะโหลด — skeleton animate-pulse
  if (!sessionReady || (user && loading && !error)) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="กำลังโหลดกระเป๋าเงิน">
        <div className="h-44 animate-pulse rounded-3xl bg-neutral-100" />
        <div className="h-5 w-32 animate-pulse rounded bg-neutral-100" />
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-16 animate-pulse rounded-2xl bg-neutral-100" />
        ))}
      </div>
    );
  }

  // สถานะผิดพลาด — ข้อความ + ปุ่มลองใหม่
  if (error) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-red-50">
          <CircleHelp className="h-8 w-8 text-red-400" aria-hidden />
        </span>
        <p className="text-sm text-red-500">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="btn-brand h-11 rounded-full px-6 text-sm"
        >
          ลองอีกครั้ง
        </button>
      </div>
    );
  }

  // ยังไม่เข้าสู่ระบบ
  if (!user) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <span className="flex h-20 w-20 items-center justify-center rounded-full bg-neutral-100">
          <Zap className="h-9 w-9 text-[#FFC400]" aria-hidden />
        </span>
        <h1 className="text-lg font-bold text-black">เข้าสู่ระบบเพื่อดูกระเป๋าเงิน</h1>
        <p className="text-sm text-neutral-400">เติมเงินและตรวจสอบยอดการใช้จ่ายของคุณ</p>
        <Link href="/login?next=%2Fwallet" className="btn-brand inline-flex h-12 items-center px-8 text-sm">
          เข้าสู่ระบบ
        </Link>
      </div>
    );
  }

  const empty = transactions.length === 0;

  return (
    <div className="space-y-5">
      {/* การ์ดยอดเงิน — พื้นดำ ตัวเลขใหญ่สีเหลืองตามต้นแบบ E-Wallet */}
      <section aria-label="ยอดเงินในกระเป๋า" className="rounded-3xl bg-black p-6">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#FFC400]">
            <Wallet className="h-5 w-5 text-black" aria-hidden />
          </span>
          <p className="text-sm text-neutral-400">กระเป๋าเงินของฉัน</p>
        </div>
        <p className="mt-4 text-4xl font-bold tabular-nums leading-tight text-[#FFC400]" data-testid="wallet-balance">
          {baht(balance)}
        </p>
        <Link
          href="/wallet/topup"
          data-testid="wallet-topup-button"
          className="btn-brand mt-5 inline-flex h-11 items-center gap-2 px-6 text-sm"
        >
          <Plus className="h-4 w-4" aria-hidden />
          เติมเงิน
        </Link>
      </section>

      {empty ? (
        // สถานะว่าง — ไอคอนในวงกลม + หัวข้อ + ปุ่ม CTA
        <div className="flex flex-col items-center gap-4 py-12 text-center">
          <span className="flex h-20 w-20 items-center justify-center rounded-full bg-neutral-100">
            <Wallet className="h-9 w-9 text-neutral-300" aria-hidden />
          </span>
          <h2 className="text-lg font-bold text-black">ยังไม่มีรายการกระเป๋าเงิน</h2>
          <p className="text-sm text-neutral-400">เติมเงินเพื่อใช้จ่ายสะดวกยิ่งขึ้น</p>
          <Link href="/wallet/topup" className="btn-brand inline-flex h-12 items-center gap-2 px-8 text-sm">
            <Plus className="h-4 w-4" aria-hidden />
            เติมเงิน
          </Link>
        </div>
      ) : (
        <section aria-label="ประวัติการใช้งาน" className="space-y-3">
          <h2 className="text-base font-bold text-black">ประวัติการใช้งาน</h2>
          <ul className="overflow-hidden rounded-3xl border border-line bg-white">
            {transactions.map((t, i) => {
              const delta = Number(t.amount_delta);
              const isIn = delta >= 0;
              return (
                <li
                  key={t.id}
                  className={`flex items-center gap-3 px-4 py-4 ${i > 0 ? 'border-t border-line' : ''}`}
                >
                  <span
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                      isIn ? 'bg-[#FFF4CC]' : 'bg-neutral-100'
                    }`}
                  >
                    {isIn ? (
                      <ArrowDownCircle className="h-5 w-5 text-[#FFC400]" aria-hidden />
                    ) : (
                      <ArrowUpCircle className="h-5 w-5 text-black" aria-hidden />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate-1 text-sm font-semibold text-black">
                      {t.reason ?? (isIn ? 'เงินเข้ากระเป๋า' : 'เงินออกจากกระเป๋า')}
                    </p>
                    <p className="truncate-1 text-xs text-neutral-400">
                      {new Date(t.created_at).toLocaleDateString('th-TH', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        timeZone: 'Asia/Bangkok',
                      })}
                    </p>
                  </div>
                  <div className="shrink-0 space-y-1 text-right">
                    <p className={`text-sm font-bold tabular-nums ${isIn ? 'text-black' : 'text-neutral-600'}`}>
                      {isIn ? '+' : '-'}
                      {baht(Math.abs(delta))}
                    </p>
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${txStatusClass(t.status)}`}
                    >
                      {TX_STATUS_TH[t.status] ?? t.status}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
