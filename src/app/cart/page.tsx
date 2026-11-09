'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ChevronLeft, Minus, Plus, ShoppingBag, Tag, Trash2, Utensils } from 'lucide-react';
import { api, baht, useCart } from '@/lib/client';

interface CartItem {
  id: string;
  quantity: number;
  unit_price: number;
  notes: string | null;
  menu_items: { name: string; image_url: string | null } | null;
}
interface CartData {
  cart: { restaurant_id: string | null } | null;
  items: CartItem[];
  restaurant: { id: string; name: string; is_open: boolean } | null;
}

const DELIVERY_FEE = 35;

export default function CartPage() {
  const { refresh } = useCart();
  const [data, setData] = useState<CartData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [promo, setPromo] = useState('');
  const [promoApplied, setPromoApplied] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    api<CartData>('/api/cart')
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const updateQty = async (itemId: string, quantity: number) => {
    setBusy(true);
    try {
      const next = await api<CartData>(`/api/cart/items/${itemId}`, {
        method: 'PATCH',
        body: JSON.stringify({ quantity }),
      });
      setData(next);
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const subtotal = (data?.items ?? []).reduce((s, i) => s + i.unit_price * i.quantity, 0);
  const hasItems = (data?.items ?? []).length > 0;

  if (loading) return <div className="h-64 animate-pulse rounded-3xl bg-neutral-100" />;
  if (error) return <p className="py-16 text-center text-sm text-red-500">{error}</p>;

  if (!hasItems) {
    return (
      <div className="flex flex-col items-center gap-4 py-20 text-center">
        <span className="flex h-24 w-24 items-center justify-center rounded-3xl bg-neutral-100">
          <ShoppingBag className="h-10 w-10 text-neutral-300" aria-hidden />
        </span>
        <h1 className="text-lg font-bold text-black">ตะกร้าว่างเปล่า</h1>
        <p className="max-w-56 text-sm text-neutral-400">
          ดูเหมือนยังไม่มีอะไรอยู่ในตะกร้า — ไปเลือกเมนูอร่อย ๆ กันเลย!
        </p>
        <Link href="/" className="btn-brand inline-flex h-12 items-center px-8 text-sm">
          ดูร้านอาหาร
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* หัวเรื่องแบบ FoodU: ลูกศร + ชื่อกลาง */}
      <div className="relative flex items-center justify-center py-1">
        <Link
          href="/"
          aria-label="ย้อนกลับ"
          className="absolute left-0 flex h-10 w-10 items-center justify-center rounded-full border border-line bg-white hover:bg-neutral-50"
        >
          <ChevronLeft className="h-5 w-5" aria-hidden />
        </Link>
        <h1 className="text-lg font-bold text-black">ตะกร้าของคุณ</h1>
      </div>

      {data?.restaurant && (
        <Link
          href={`/restaurants/${data.restaurant.id}`}
          className="block truncate-1 text-sm font-medium text-neutral-500 hover:text-black"
        >
          จากร้าน <span className="font-bold text-black">{data.restaurant.name}</span> ›
        </Link>
      )}

      {/* รายการอาหาร — แถวแบบ FoodU: รูปซ้าย ชื่อ+ราคา สเต็ปเปอร์ขวา */}
      <ul className="space-y-3">
        {data!.items.map((item) => (
          <li
            key={item.id}
            className="flex items-center gap-3 rounded-3xl border border-line bg-white p-3 shadow-sm"
          >
            <div className="h-16 w-16 shrink-0 overflow-hidden rounded-2xl bg-neutral-100">
              {item.menu_items?.image_url ? (
                 
                <img
                  src={item.menu_items.image_url}
                  alt={item.menu_items.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="flex h-full w-full items-center justify-center text-neutral-300"><Utensils className="h-6 w-6" aria-hidden /></span>
              )}
            </div>
            <div className="min-w-0 flex-1 space-y-0.5">
              <h2 className="truncate-1 text-sm font-bold text-black">
                {item.menu_items?.name ?? 'รายการอาหาร'}
              </h2>
              <span className="block text-sm font-bold text-black">
                {baht(item.unit_price * item.quantity)}
              </span>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                onClick={() => void updateQty(item.id, item.quantity - 1)}
                disabled={busy}
                aria-label="ลดจำนวน"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-line hover:bg-neutral-50 active:scale-90"
              >
                <Minus className="h-4 w-4" aria-hidden />
              </button>
              <span className="w-6 text-center text-sm font-bold tabular-nums">{item.quantity}</span>
              <button
                onClick={() => void updateQty(item.id, item.quantity + 1)}
                disabled={busy}
                aria-label="เพิ่มจำนวน"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-black text-[#FFC400] active:scale-90"
              >
                <Plus className="h-4 w-4" aria-hidden />
              </button>
              <button
                onClick={() => void updateQty(item.id, 0)}
                disabled={busy}
                aria-label="ลบรายการ"
                className="flex h-9 w-9 items-center justify-center rounded-full text-red-400 hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4" aria-hidden />
              </button>
            </div>
          </li>
        ))}
      </ul>

      {/* โค้ดส่วนลด */}
      <section aria-label="โค้ดส่วนลด" className="flex items-center gap-2 rounded-3xl border border-line bg-white p-3">
        <Tag className="ml-1 h-5 w-5 shrink-0 text-neutral-400" aria-hidden />
        <input
          value={promo}
          onChange={(e) => {
            setPromo(e.target.value.toUpperCase());
            setPromoApplied(null);
          }}
          placeholder="ใส่โค้ดส่วนลด"
          aria-label="โค้ดส่วนลด"
          className="h-9 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-neutral-400"
        />
        <button
          onClick={() => promo.trim() && setPromoApplied(promo.trim())}
          className="btn-brand h-9 shrink-0 px-4 text-xs"
        >
          ใช้โค้ด
        </button>
      </section>
      {promoApplied && (
        <p className="-mt-2 px-2 text-xs text-neutral-500">
          ใส่โค้ด <span className="font-bold text-black">{promoApplied}</span> แล้ว — ส่วนลดจะหักที่หน้าชำระเงิน
        </p>
      )}

      {/* สรุปยอด + ปุ่มชำระแบบ sticky (ลอยเหนือแถบล่าง) */}
      <section
        aria-label="สรุปยอดรวม"
        className="space-y-2 rounded-3xl border border-line bg-white p-4 text-sm"
      >
        <div className="flex justify-between text-neutral-500">
          <span>ยอดอาหาร</span>
          <span className="tabular-nums">{baht(subtotal)}</span>
        </div>
        <div className="flex justify-between text-neutral-500">
          <span>ค่าจัดส่ง</span>
          <span className="tabular-nums">{baht(DELIVERY_FEE)}</span>
        </div>
        <div className="flex justify-between border-t border-line pt-2 text-base font-bold text-black">
          <span>รวมทั้งสิ้น</span>
          <span className="tabular-nums">{baht(subtotal + DELIVERY_FEE)}</span>
        </div>
      </section>

      <div className="sticky bottom-20 z-30">
        <Link
          href="/checkout"
          className="btn-brand flex h-14 w-full items-center justify-between px-6 text-sm shadow-lg shadow-black/10"
        >
          <span>ไปชำระเงิน</span>
          <span className="font-bold tabular-nums">{baht(subtotal + DELIVERY_FEE)}</span>
        </Link>
      </div>
    </div>
  );
}
