'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Bike, PackageCheck, Star, Wallet } from 'lucide-react';
import { api, baht } from '@/lib/client';

interface Earnings {
  totalEarningsSatang: number;
  totalDeliveries: number;
  rating: number | null;
  weekEarningsSatang: number;
  weekTrips: number;
  days: { date: string; earning: number; count: number }[];
}

/** หน้ารายได้ไรเดอร์ — รวมทั้งหมด + รายวัน 7 วัน (จาก delivery_tasks จริง) */
export default function DriverEarningsPage() {
  const [data, setData] = useState<Earnings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api<Earnings>('/api/driver/earnings')
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  const maxEarn = Math.max(1, ...(data?.days.map((d) => d.earning) ?? [1]));
  const dayLabel = (iso: string) =>
    new Date(iso + 'T00:00:00+07:00').toLocaleDateString('th-TH', { weekday: 'short', day: 'numeric' });

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <header className="sticky top-0 z-40 border-b border-line bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-2 px-4">
          <Link
            href="/driver"
            aria-label="ย้อนกลับ"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-neutral-100 transition-transform active:scale-95"
          >
            <ArrowLeft className="h-5 w-5" aria-hidden />
          </Link>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#FFC400] text-black">
            <Wallet className="h-5 w-5" aria-hidden />
          </span>
          <h1 className="text-sm font-bold text-black">รายได้ของฉัน</h1>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 space-y-5 px-4 py-5">
        {error && <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-24 animate-pulse rounded-3xl bg-neutral-100" />
            ))}
          </div>
        ) : data && (
          <>
            <section className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label="สรุปรายได้">
              {[
                { label: 'รายได้รวม', value: baht(data.totalEarningsSatang), Icon: Wallet },
                { label: 'ส่งสำเร็จทั้งหมด', value: `${data.totalDeliveries} ไรด์`, Icon: PackageCheck },
                { label: 'คะแนนเฉลี่ย', value: (data.rating ?? 0).toFixed(1), Icon: Star },
                { label: 'รายได้ 7 วัน', value: baht(data.weekEarningsSatang), Icon: Bike },
              ].map(({ label, value, Icon }) => (
                <div key={label} className="rounded-3xl border border-line bg-white p-4">
                  <Icon className="h-5 w-5 text-black" aria-hidden />
                  <p className="mt-2 text-lg font-bold text-black">{value}</p>
                  <p className="text-xs text-neutral-500">{label}</p>
                </div>
              ))}
            </section>

            <section className="rounded-3xl border border-line p-4" aria-label="รายได้รายวัน">
              <h2 className="mb-3 text-sm font-bold text-black">รายได้รายวัน (7 วัน · {data.weekTrips} ไรด์)</h2>
              <div className="flex h-40 items-end gap-2">
                {data.days.map((d) => (
                  <div key={d.date} className="flex min-w-0 flex-1 flex-col items-center gap-1">
                    <span className="text-[10px] font-bold text-neutral-500">{d.earning > 0 ? baht(d.earning) : ''}</span>
                    <div
                      className={`w-full max-w-10 rounded-t-xl ${d.earning > 0 ? 'bg-[#FFC400]' : 'bg-neutral-100'}`}
                      style={{ height: `${Math.max(4, (d.earning / maxEarn) * 120)}px` }}
                      role="img"
                      aria-label={`${dayLabel(d.date)} ${baht(d.earning)} ${d.count} ไรด์`}
                    />
                    <span className="text-[10px] text-neutral-400">{dayLabel(d.date)}</span>
                    <span className="text-[10px] font-semibold text-neutral-500">{d.count > 0 ? `${d.count} ไรด์` : ''}</span>
                  </div>
                ))}
              </div>
            </section>

            <p className="rounded-3xl bg-[#FFF4CC] px-4 py-3 text-xs text-neutral-600">
              รายได้ต่อไรด์ = ค่าส่งเต็มจำนวนของออเดอร์ที่ส่งสำเร็จ (บันทึกอัตโนมัติเมื่อกด "ส่งถึงลูกค้าแล้ว")
            </p>
          </>
        )}
      </main>

      <footer className="mt-auto border-t border-line bg-white pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-4 text-center text-xs text-neutral-400">
        © {new Date().getFullYear()} ฟู๊ด ธันเดอร์ — พอร์ทัลไรเดอร์
      </footer>
    </div>
  );
}
