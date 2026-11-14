'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { BadgePercent, Banknote, QrCode, TicketX, Wallet } from 'lucide-react';
import { api, baht } from '@/lib/client';

interface CartData {
  cart: { restaurant_id: string | null } | null;
  items: { id: string; quantity: number; unit_price: number; menu_items: { name: string } | null }[];
  restaurant: { name: string } | null;
}

const DELIVERY_FEE = 3500; // สตางค์ตามมาตรฐานฐานข้อมูล (฿35)

interface ValidateResult {
  valid: boolean;
  code?: string;
  discount?: number;
  message?: string;
  error?: string;
}

export default function CheckoutPage() {
  const router = useRouter();
  const [data, setData] = useState<CartData | null>(null);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // คูปอง
  const [couponInput, setCouponInput] = useState('');
  const [coupon, setCoupon] = useState<{ code: string; discount: number } | null>(null);
  const [couponMsg, setCouponMsg] = useState('');
  const [couponErr, setCouponErr] = useState('');
  const [checkingCoupon, setCheckingCoupon] = useState(false);

  // วิธีชำระเงิน (เฟส 5.2): กระเป๋าเงิน / เงินสดปลายทาง / พร้อมเพย์ QR
  const [paymentMethod, setPaymentMethod] = useState<'wallet' | 'cash' | 'promptpay'>('promptpay');
  const [walletBalance, setWalletBalance] = useState<number | null>(null);

  useEffect(() => {
    api<CartData>('/api/cart').then(setData).catch(() => router.replace('/cart'));
  }, [router]);

  // ยอดกระเป๋าเงิน — แสดงและใช้กันว่า "ยอดไม่พอ" ตั้งแต่หน้าเช็กเอาต์ (ตรวจจริงอีกชั้นที่ backend)
  useEffect(() => {
    api<{ data: { balance: number } }>('/api/wallet')
      .then((r) => setWalletBalance(r.data?.balance ?? 0))
      .catch(() => setWalletBalance(null));
  }, []);

  const subtotal = (data?.items ?? []).reduce((s, i) => s + i.unit_price * i.quantity, 0); // สตางค์
  const discount = coupon?.discount ?? 0;
  const total = Math.max(0, subtotal + DELIVERY_FEE - discount);

  const applyCoupon = async (rawCode?: string) => {
    const code = (rawCode ?? couponInput).trim();
    if (!code) {
      setCouponErr('กรุณากรอกรหัสคูปอง');
      return;
    }
    if (subtotal <= 0) return;
    setCheckingCoupon(true);
    setCouponErr('');
    setCouponMsg('');
    try {
      const res = await api<ValidateResult>('/api/promotions/validate', {
        method: 'POST',
        body: JSON.stringify({ code, subtotal }),
      });
      if (res.valid && res.discount) {
        setCoupon({ code: res.code ?? code.toUpperCase(), discount: res.discount });
        setCouponMsg(res.message ?? 'ใช้คูปองสำเร็จ');
      } else {
        setCoupon(null);
        setCouponErr(res.error ?? 'ใช้คูปองไม่สำเร็จ');
      }
    } catch (e) {
      setCoupon(null);
      setCouponErr(e instanceof Error ? e.message : 'ตรวจคูปองไม่สำเร็จ');
    } finally {
      setCheckingCoupon(false);
    }
  };

  // โค้ดที่ใช้ไว้ในหน้าตะกร้า → มาใช้ต่อที่หน้านี้อัตโนมัติ
  useEffect(() => {
    if (!data || data.items.length === 0 || coupon) return;
    let saved = '';
    try { saved = sessionStorage.getItem('ft_coupon') ?? ''; } catch { /* ignore */ }
    if (saved) {
      setCouponInput(saved);
      void applyCoupon(saved);
      try { sessionStorage.removeItem('ft_coupon'); } catch { /* ignore */ }
    }
  }, [data]);

  const removeCoupon = () => {
    setCoupon(null);
    setCouponMsg('');
    setCouponErr('');
    setCouponInput('');
  };

  const submit = async () => {
    setSubmitting(true);
    setError('');
    try {
      const res = await api<{ order: { id: string } }>('/api/orders', {
        method: 'POST',
        body: JSON.stringify({
          notes: notes || null,
          couponCode: coupon?.code ?? null,
          paymentMethod,
        }),
      });
      router.push(`/orders/${res.order.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'สั่งซื้อไม่สำเร็จ');
      setSubmitting(false);
    }
  };

  const walletEnough = walletBalance === null ? true : walletBalance >= total;
  const PAYMENTS: { key: 'wallet' | 'cash' | 'promptpay'; label: string; sub: string; Icon: typeof Wallet }[] = [
    {
      key: 'wallet',
      label: 'กระเป๋าเงิน',
      sub: walletBalance !== null ? `ยอดคงเหลือ ${baht(walletBalance)}` : 'กำลังโหลดยอด…',
      Icon: Wallet,
    },
    { key: 'cash', label: 'เงินสดปลายทาง', sub: 'จ่ายเงินสดให้ไรเดอร์เมื่อส่งถึง', Icon: Banknote },
    { key: 'promptpay', label: 'พร้อมเพย์ QR', sub: 'สแกนจ่ายง่าย ไม่มีค่าธรรมเนียม', Icon: QrCode },
  ];

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

      <section aria-label="รหัสคูปอง" className="space-y-2 rounded-3xl border border-line bg-white p-4">
        <label htmlFor="coupon" className="text-sm font-medium text-black">รหัสคูปอง</label>
        {coupon ? (
          <div className="flex items-center justify-between gap-3 rounded-2xl bg-[#FFF4CC] px-4 py-3">
            <div className="flex min-w-0 items-center gap-2">
              <BadgePercent className="h-5 w-5 shrink-0 text-black" aria-hidden />
              <p className="truncate-1 text-sm font-bold text-black">
                {coupon.code} · ลด {baht(coupon.discount)}
              </p>
            </div>
            <button
              type="button"
              onClick={removeCoupon}
              aria-label="นำคูปองออก"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-neutral-500 hover:text-black"
            >
              <TicketX className="h-5 w-5" aria-hidden />
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <input
              id="coupon"
              value={couponInput}
              onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
              placeholder="เช่น THUNDER30"
              className="min-w-0 flex-1 rounded-2xl border border-line bg-neutral-50 px-4 py-3 text-sm uppercase tracking-wide outline-none focus:border-black"
            />
            <button
              type="button"
              onClick={() => void applyCoupon()}
              disabled={checkingCoupon || subtotal <= 0}
              className="h-12 shrink-0 rounded-2xl bg-black px-5 text-sm font-bold text-[#FFC400] disabled:opacity-50"
            >
              {checkingCoupon ? 'กำลังตรวจ…' : 'ใช้โค้ด'}
            </button>
          </div>
        )}
        {couponMsg && <p className="text-xs font-medium text-emerald-600" role="status">{couponMsg}</p>}
        {couponErr && <p className="text-xs text-red-600" role="alert">{couponErr}</p>}
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

      <section aria-label="วิธีชำระเงิน" className="space-y-3">
        <h2 className="text-sm font-medium text-black">วิธีชำระเงิน</h2>
        {PAYMENTS.map((p) => {
          const selected = paymentMethod === p.key;
          const disabled = p.key === 'wallet' && !walletEnough;
          return (
            <button
              key={p.key}
              type="button"
              onClick={() => {
                if (!disabled) setPaymentMethod(p.key);
              }}
              aria-pressed={selected}
              disabled={disabled}
              className={`flex w-full items-center gap-3 rounded-3xl p-4 text-left transition-colors ${
                selected
                  ? 'border-2 border-black bg-[#FFC400]/10'
                  : disabled
                    ? 'border border-line bg-neutral-50 opacity-60'
                    : 'border border-line bg-white hover:bg-neutral-50'
              }`}
            >
              <span
                className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${
                  selected ? 'bg-black text-[#FFC400]' : 'bg-neutral-100 text-black'
                }`}
              >
                <p.Icon className="h-6 w-6" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-black">{p.label}</p>
                <p className="truncate-1 text-xs text-neutral-500">{p.sub}</p>
              </div>
              {selected && (
                <span className="shrink-0 rounded-full bg-black px-3 py-1 text-[11px] font-bold text-[#FFC400]">
                  เลือกแล้ว
                </span>
              )}
              {disabled && (
                <span className="shrink-0 rounded-full bg-neutral-100 px-3 py-1 text-[11px] font-bold text-neutral-500">
                  ยอดไม่พอ
                </span>
              )}
            </button>
          );
        })}
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
        {discount > 0 && (
          <div className="flex justify-between font-medium text-emerald-600">
            <span>ส่วนลดคูปอง ({coupon?.code})</span>
            <span className="tabular-nums">−{baht(discount)}</span>
          </div>
        )}
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
