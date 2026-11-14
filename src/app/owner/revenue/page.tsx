'use client';

import { useEffect, useState } from 'react';
import { BadgeCheck, Clock, Phone, Wallet } from 'lucide-react';
import { api, baht } from '@/lib/client';
import { OwnerSubShell } from '@/components/portal/owner-header';

interface Summary {
  gross: number;
  commission: number;
  net: number;
  orders: number;
}

interface Payout {
  id: string;
  amount: number;
  currency: string;
  status: string;
  settled_at: string | null;
  created_at: string;
}

interface RevenueData {
  today: Summary;
  d7: Summary;
  d30: Summary;
  payouts: Payout[];
  phone: string | null;
}

/** การ์ดสรุปรายได้สุทธิ + ค่าคอมเป็นข้อความรอง */
function StatCard({ label, summary, Icon }: { label: string; summary: Summary; Icon: typeof Wallet }) {
  return (
    <section className="rounded-3xl border border-line bg-white p-4" aria-label={label}>
      <div className="flex items-center justify-between">
        <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#FFF4CC] text-black">
          <Icon className="h-5 w-5" aria-hidden />
        </span>
        <span className="text-[11px] font-bold text-neutral-400">{summary.orders} ออเดอร์</span>
      </div>
      <p className="mt-2 text-2xl font-bold text-black">{baht(summary.net)}</p>
      <p className="text-xs font-semibold text-neutral-500">{label}</p>
      <p className="mt-1 text-[11px] text-neutral-400">ค่าคอมมิชชัน {baht(summary.commission)} · ยอดรวม {baht(summary.gross)}</p>
    </section>
  );
}

/** หน้ารายได้ — สรุปรายได้สุทธิ วันนี้/7 วัน/30 วัน + บัญชีรับเงิน + รายการตั้งเวลารับเงิน */
export default function OwnerRevenuePage() {
  const [data, setData] = useState<RevenueData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api<RevenueData>('/api/owner/revenue')
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const thaiDate = (iso: string | null) =>
    iso
      ? new Date(iso).toLocaleString('th-TH', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
      : '-';

  return (
    <OwnerSubShell title="รายได้ของร้าน" subtitle="ยอดสุทธิหลังหักค่าคอมมิชชัน" Icon={Wallet}>
      {error && (
        <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </p>
      )}

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-3xl bg-neutral-100" />
          ))}
        </div>
      ) : data && (
        <>
          {/* สรุปรายได้สุทธิ */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <StatCard label="รายได้สุทธิวันนี้" summary={data.today} Icon={Wallet} />
            <StatCard label="รายได้สุทธิ 7 วัน" summary={data.d7} Icon={Wallet} />
            <StatCard label="รายได้สุทธิ 30 วัน" summary={data.d30} Icon={Wallet} />
          </div>

          {/* บัญชีรับเงิน */}
          <section className="flex items-center gap-3 rounded-3xl border border-line bg-white p-4" aria-label="บัญชีรับเงิน">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-black text-[#FFC400]">
              <Phone className="h-5 w-5" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-bold text-black">บัญชีรับเงิน PromptPay</p>
              <p className="truncate-1 text-xs text-neutral-500">
                {data.phone ? `เบอร์ร้าน ${data.phone}` : 'ยังไม่ได้ตั้งเบอร์ร้าน — เพิ่มได้ในหน้าตั้งค่า'}
              </p>
            </div>
            <BadgeCheck className="ml-auto h-5 w-5 shrink-0 text-[#FFC400]" aria-hidden />
          </section>

          {/* รายการตั้งเวลารับเงิน */}
          <section aria-label="รายการตั้งเวลารับเงิน">
            <h2 className="mb-2 text-sm font-bold text-black">รายการตั้งเวลารับเงิน</h2>
            {data.payouts.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-line px-4 py-10 text-center">
                <Wallet className="mx-auto h-8 w-8 text-neutral-300" aria-hidden />
                <p className="mt-2 text-sm text-neutral-400">ยังไม่มีรายการรับเงิน — จะแสดงเมื่อมีการตั้งเวลาโอน</p>
              </div>
            ) : (
              <ul className="space-y-2">
                {data.payouts.map((p) => (
                  <li key={p.id} className="flex items-center gap-3 rounded-3xl border border-line bg-white p-4 shadow-sm">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#FFF4CC] text-black">
                      <Wallet className="h-5 w-5" aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-black">{baht(p.amount)}</p>
                      <p className="flex items-center gap-1 text-[11px] text-neutral-400">
                        <Clock className="h-3 w-3" aria-hidden />
                        {p.status === 'pending'
                          ? `รอตั้งเวลา · สร้าง ${thaiDate(p.created_at)}`
                          : `เข้าบัญชีแล้ว · ${thaiDate(p.settled_at)}`}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${
                        p.status === 'pending' ? 'bg-[#FFF4CC] text-black' : 'bg-black text-white'
                      }`}
                    >
                      {p.status === 'pending' ? 'รอตั้งเวลา' : 'เข้าบัญชีแล้ว'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </OwnerSubShell>
  );
}
