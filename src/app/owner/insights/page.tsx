'use client';

import { useEffect, useState } from 'react';
import { CalendarDays, Clock, Lightbulb, PackageX, Star } from 'lucide-react';
import { api } from '@/lib/client';
import { OwnerSubShell } from '@/components/portal/owner-header';

interface Insights {
  bestWeekday: { day: number; dayLabel: string; count: number } | null;
  bestHour: { hour: number; count: number } | null;
  lowRated: { name: string; count: number; avg: number }[];
  soldOut: string[];
}

/** หน้าข้อเสนอแนะ — สรุปจุดที่ควรใช้ประโยชน์/ปรับปรุงจากข้อมูลจริงของร้าน */
export default function OwnerInsightsPage() {
  const [data, setData] = useState<Insights | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api<Insights>('/api/owner/insights')
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <OwnerSubShell title="ข้อเสนอแนะสำหรับร้าน" subtitle="จากข้อมูลออเดอร์ รีวิว และเมนูของคุณ" Icon={Lightbulb}>
      {error && (
        <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </p>
      )}

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-3xl bg-neutral-100" />
          ))}
        </div>
      ) : data && (
        <ul className="space-y-3">
          {/* วันที่ขายดีที่สุด */}
          {data.bestWeekday && (
            <li className="flex gap-3 rounded-3xl border border-line bg-white p-4 shadow-sm">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#FFF4CC] text-black">
                <CalendarDays className="h-5 w-5" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-bold text-black">
                  วัน{data.bestWeekday.dayLabel}ขายดีที่สุด — เตรียมของเพิ่ม
                </p>
                <p className="mt-0.5 text-xs text-neutral-500">
                  ออเดอร์ในวัน{data.bestWeekday.dayLabel}เฉลี่ยมากที่สุด ({data.bestWeekday.count} ใบใน 30 วันล่าสุด)
                </p>
              </div>
            </li>
          )}

          {/* ช่วงเวลาที่ออเดอร์เยอะ */}
          {data.bestHour && (
            <li className="flex gap-3 rounded-3xl border border-line bg-white p-4 shadow-sm">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#FFF4CC] text-black">
                <Clock className="h-5 w-5" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-bold text-black">ช่วง {data.bestHour.hour}:00 ออเดอร์เยอะ</p>
                <p className="mt-0.5 text-xs text-neutral-500">
                  ควรจัดกำลังครัวให้พร้อมก่อนถึงช่วงพีค ({data.bestHour.count} ใบใน 30 วันล่าสุด)
                </p>
              </div>
            </li>
          )}

          {/* เมนูคะแนนต่ำ */}
          {data.lowRated.map((it) => (
            <li key={it.name} className="flex gap-3 rounded-3xl border border-line bg-white p-4 shadow-sm">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-red-50 text-red-600">
                <Star className="h-5 w-5" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-bold text-black">เมนู {it.name} คะแนนต่ำ — ควรปรับรส</p>
                <p className="mt-0.5 text-xs text-neutral-500">
                  คะแนนเฉลี่ย {it.avg.toFixed(1)} จากรีวิวคะแนนต่ำ {it.count} ครั้ง
                </p>
              </div>
            </li>
          ))}

          {/* เมนูหมดวันนี้ */}
          {data.soldOut.length > 0 && (
            <li className="flex gap-3 rounded-3xl border border-line bg-white p-4 shadow-sm">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#FFF4CC] text-black">
                <PackageX className="h-5 w-5" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-bold text-black">
                  มี {data.soldOut.length} เมนูหมดวันนี้ — อัปเดตเร็ว ๆ นี้
                </p>
                <p className="mt-0.5 truncate-1 text-xs text-neutral-500">{data.soldOut.join(' · ')}</p>
              </div>
            </li>
          )}

          {/* ไม่มีข้อเสนอแนะ */}
          {!data.bestWeekday && !data.bestHour && data.lowRated.length === 0 && data.soldOut.length === 0 && (
            <li className="rounded-3xl border border-dashed border-line px-4 py-10 text-center">
              <Lightbulb className="mx-auto h-8 w-8 text-neutral-300" aria-hidden />
              <p className="mt-2 text-sm text-neutral-400">ยังไม่มีข้อมูลเพียงพอ — จะมีข้อเสนอแนะเมื่อร้านมีออเดอร์และรีวิวมากขึ้น</p>
            </li>
          )}
        </ul>
      )}
    </OwnerSubShell>
  );
}
