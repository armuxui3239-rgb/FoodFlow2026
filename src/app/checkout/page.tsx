'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { QrCode } from 'lucide-react';
import { api, baht } from '@/lib/client';

interface CartData {
  cart: { restaurant_id: string | null } | null;
  items: { id: string; quantity: number; unit_price: number; menu_items: { name: string } | null }[];
  restaurant: { name: string } | null;
}

const DELIVERY_FEE = 35;

export default function CheckoutPage() {
  const router = useRouter();
  const [data, setData] = useState<CartData | null>(null);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api<CartData>('/api/cart').then(setData).catch(() => router.replace('/cart'));
  }, [router]);

  const subtotal = (data?.items ?? []).reduce((s, i) => s + i.unit_price * i.quantity, 0);
  const total = subtotal + DELIVERY_FEE;

  const submit = async () => {
    setSubmitting(true);
    setError('');
    try {
      const res = await api<{ order: { id: string } }>('/api/orders', {
        method: 'POST',
        body: JSON.stringify({ notes: notes || null }),
      });
      router.push(`/orders/${res.order.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'สั่งซื้อไม่สำเร็จ');
      setSubmitting(false);
    }
  };

  if (!data) return <div className="h-64 animate-pulse rounded-3xl bg-neutral-100" />;
  if (data.items.length === 0) {
    return <p className="py-16 text-center text-sm text-neutral-400">ตะกร้าว่าง — ไม่สามารถชำระเงินได้</p>;
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-black">ชำระเงิน</h1>
      {data.restaurant && <p className="truncate-1 text-sm text-neutral-500">ร้าน {data.restaurant.name}</p>}

      <section aria-label="รายการอาหาร" className="space-y-2 rounded-3xl border border-line bg-white p-4">
        {data.items.map((i) => (
          <div key={i.id} className="flex justify-between gap-3 text-sm">
            <span className="truncate-1 text-neutral-600">
              {i.menu_items?.name ?? 'รายการอาหาร'} × {i.quantity}
            </span>
            <span className="shrink-0 font-medium tabular-nums">{baht(i.unit_price * i.quantity)}</span>
          </div>
        ))}
      </section>

      <section className="space-y-2">
        <label htmlFor="notes" className="text-sm font-medium text-black">บันทึกถึงร้าน (ถ้ามี)</label>
        <textarea
          id="notes"
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="เช่น ไม่เอาหอม เผ็ดน้อย"
          className="w-full rounded-2xl border border-line bg-neutral-50 px-4 py-3 text-sm outline-none focus:border-black"
        />
      </section>

      <section aria-label="วิธีชำระเงิน" className="flex items-center gap-3 rounded-3xl border-2 border-black bg-[#FFC400]/10 p-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-black text-[#FFC400]">
          <QrCode className="h-6 w-6" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-black">PromptPay</p>
          <p className="truncate-1 text-xs text-neutral-500">สแกนจ่ายง่าย ไม่มีค่าธรรมเนียม</p>
        </div>
        <span className="shrink-0 rounded-full bg-black px-3 py-1 text-[11px] font-bold text-[#FFC400]">เลือกแล้ว</span>
      </section>

      <section aria-label="สรุปยอด" className="space-y-2 rounded-3xl border border-line bg-white p-4 text-sm">
        <div className="flex justify-between text-neutral-500">
          <span>ยอดอาหาร</span>
          <span className="tabular-nums">{baht(subtotal)}</span>
        </div>
        <div className="flex justify-between text-neutral-500">
          <span>ค่าจัดส่ง</span>
          <span className="tabular-nums">{baht(DELIVERY_FEE)}</span>
        </div>
        <div className="flex justify-between border-t border-line pt-2 text-base font-bold text-black">
          <span>ยอดที่ต้องชำระ</span>
          <span className="tabular-nums">{baht(total)}</span>
        </div>
      </section>

      {error && (
        <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>
      )}
      <button onClick={() => void submit()} disabled={submitting} className="btn-brand h-12 w-full text-sm">
        {submitting ? 'กำลังสร้างคำสั่งซื้อ…' : `ยืนยันคำสั่งซื้อ · ${baht(total)}`}
      </button>
    </div>
  );
}
