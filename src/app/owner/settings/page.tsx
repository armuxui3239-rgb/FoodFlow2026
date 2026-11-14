'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Clock, Phone, Power, Save, Store } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { api } from '@/lib/client';

interface HourRow {
  id: string;
  day_of_week: number;
  open_time: string | null;
  close_time: string | null;
  is_closed: boolean;
}

const DAYS = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัส', 'ศุกร์', 'เสาร์'];

/** หน้าตั้งค่าร้าน — เปิด/ปิดร้าน ขั้นต่ำ เบอร์โทร เวลาเปิด 7 วัน (บันทึกจริงในฐานข้อมูล) */
export default function OwnerSettingsPage() {
  const [name, setName] = useState('');
  const [isOpen, setIsOpen] = useState(true);
  const [minOrder, setMinOrder] = useState('');
  const [phone, setPhone] = useState('');
  const [prep, setPrep] = useState('');
  const [hours, setHours] = useState<HourRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api<{ restaurant: { name: string; phone: string | null; min_order_amount: number | null; is_open: boolean; prep_time_avg_minutes: number | null }; hours: HourRow[] }>('/api/owner/settings')
      .then((d) => {
        setName(d.restaurant.name);
        setIsOpen(d.restaurant.is_open);
        setMinOrder(String(((d.restaurant.min_order_amount ?? 0) / 100).toFixed(0)));
        setPhone(d.restaurant.phone ?? '');
        setPrep(String(d.restaurant.prep_time_avg_minutes ?? 20));
        setHours(d.hours);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  const save = async () => {
    setSaving(true);
    setMsg('');
    setError('');
    try {
      await api('/api/owner/settings', {
        method: 'PATCH',
        body: JSON.stringify({
          isOpen,
          minOrderBaht: Number(minOrder) || 0,
          phone,
          prepMinutes: Number(prep) || 20,
          hours: hours.map((h) => ({
            dayOfWeek: h.day_of_week,
            opensAt: h.open_time ?? '08:00',
            closesAt: h.close_time ?? '21:00',
            isClosed: h.is_closed,
          })),
        }),
      });
      setMsg('บันทึกเรียบร้อยแล้ว');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const setHour = (idx: number, patch: Partial<HourRow>) => {
    setHours((hs) => hs.map((h, i) => (i === idx ? { ...h, ...patch } : h)));
  };

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <header className="sticky top-0 z-40 border-b border-line bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-2 px-4">
          <div className="flex min-w-0 items-center gap-2">
            <Link
              href="/owner"
              aria-label="ย้อนกลับ"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-neutral-100 transition-transform active:scale-95"
            >
              <ArrowLeft className="h-5 w-5" aria-hidden />
            </Link>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#FFC400] text-black">
              <Store className="h-5 w-5" aria-hidden />
            </span>
            <h1 className="truncate-1 text-sm font-bold text-black">ตั้งค่าร้าน</h1>
          </div>
          <button
            onClick={() => void save()}
            disabled={saving || loading}
            className="btn-brand flex h-10 items-center gap-1.5 px-4 text-xs disabled:opacity-50"
          >
            <Save className="h-4 w-4" aria-hidden /> {saving ? 'กำลังบันทึก…' : 'บันทึก'}
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 space-y-5 px-4 py-5">
        {error && <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}
        {msg && <p role="status" className="rounded-2xl bg-[#FFF4CC] px-4 py-3 text-sm font-semibold text-black">{msg}</p>}

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-20 animate-pulse rounded-3xl bg-neutral-100" />
            ))}
          </div>
        ) : (
          <>
            {/* สถานะร้าน */}
            <section className={`flex items-center justify-between rounded-3xl border p-4 ${isOpen ? 'border-[#FFC400] bg-[#FFF4CC]' : 'border-line bg-white'}`} aria-label="สถานะร้าน">
              <div className="flex items-center gap-3">
                <span className={`flex h-11 w-11 items-center justify-center rounded-2xl ${isOpen ? 'bg-black text-[#FFC400]' : 'bg-neutral-100 text-neutral-400'}`}>
                  <Power className="h-5 w-5" aria-hidden />
                </span>
                <div>
                  <p className="text-sm font-bold text-black">{isOpen ? 'ร้านเปิดรับออเดอร์' : 'ร้านปิดรับออเดอร์'}</p>
                  <p className="text-xs text-neutral-500">ปิดร้านชั่วคราวเมื่อเต็มกำลังหรือวันหยุด</p>
                </div>
              </div>
              <Switch checked={isOpen} onCheckedChange={setIsOpen} aria-label="เปิดปิดร้าน" />
            </section>

            {/* ข้อมูลพื้นฐาน */}
            <section className="space-y-3 rounded-3xl border border-line p-4" aria-label="ข้อมูลร้าน">
              <h2 className="text-sm font-bold text-black">ข้อมูลร้าน: {name}</h2>
              <label className="block">
                <span className="mb-1 flex items-center gap-1 text-xs font-semibold text-neutral-500">
                  <Store className="h-3.5 w-3.5" aria-hidden /> ยอดสั่งขั้นต่ำ (บาท)
                </span>
                <input
                  type="number" min={0} value={minOrder} onChange={(e) => setMinOrder(e.target.value)}
                  className="h-11 w-full rounded-2xl border border-line px-4 text-sm outline-none focus:border-[#FFC400]"
                />
              </label>
              <label className="block">
                <span className="mb-1 flex items-center gap-1 text-xs font-semibold text-neutral-500">
                  <Phone className="h-3.5 w-3.5" aria-hidden /> เบอร์โทรร้าน (ใช้เป็น PromptPay)
                </span>
                <input
                  type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
                  className="h-11 w-full rounded-2xl border border-line px-4 text-sm outline-none focus:border-[#FFC400]"
                />
              </label>
              <label className="block">
                <span className="mb-1 flex items-center gap-1 text-xs font-semibold text-neutral-500">
                  <Clock className="h-3.5 w-3.5" aria-hidden /> เวลาเตรียมอาหารเฉลี่ย (นาที)
                </span>
                <input
                  type="number" min={5} max={180} value={prep} onChange={(e) => setPrep(e.target.value)}
                  className="h-11 w-full rounded-2xl border border-line px-4 text-sm outline-none focus:border-[#FFC400]"
                />
              </label>
            </section>

            {/* เวลาเปิดรายวัน */}
            <section className="rounded-3xl border border-line p-4" aria-label="เวลาเปิดทำการ">
              <h2 className="mb-3 text-sm font-bold text-black">เวลาเปิดทำการ</h2>
              <ul className="space-y-2">
                {hours.map((h, idx) => (
                  <li key={h.id} className="flex items-center gap-2">
                    <span className="w-14 shrink-0 text-xs font-bold text-black">{DAYS[h.day_of_week] ?? h.day_of_week}</span>
                    {h.is_closed ? (
                      <span className="flex-1 text-xs text-neutral-400">ปิดทำการ</span>
                    ) : (
                      <span className="flex flex-1 items-center gap-1.5">
                        <input
                          type="time" value={(h.open_time ?? '08:00').slice(0, 5)}
                          onChange={(e) => setHour(idx, { open_time: e.target.value })}
                          className="h-9 flex-1 rounded-xl border border-line px-2 text-xs outline-none focus:border-[#FFC400]"
                        />
                        <span className="text-xs text-neutral-400">–</span>
                        <input
                          type="time" value={(h.close_time ?? '21:00').slice(0, 5)}
                          onChange={(e) => setHour(idx, { close_time: e.target.value })}
                          className="h-9 flex-1 rounded-xl border border-line px-2 text-xs outline-none focus:border-[#FFC400]"
                        />
                      </span>
                    )}
                    <button
                      onClick={() => setHour(idx, { is_closed: !h.is_closed })}
                      className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold ${h.is_closed ? 'bg-neutral-100 text-neutral-500' : 'bg-[#FFF4CC] text-black'}`}
                    >
                      {h.is_closed ? 'เปิดขาย' : 'ปิดวันนี้'}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          </>
        )}
      </main>

      <footer className="mt-auto border-t border-line bg-white pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-4 text-center text-xs text-neutral-400">
        © {new Date().getFullYear()} ฟู๊ด ธันเดอร์ — พอร์ทัลร้านค้า
      </footer>
    </div>
  );
}
