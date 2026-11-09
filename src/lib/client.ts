'use client';

import { create } from 'zustand';

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(path, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers ?? {}) },
  });
  const body = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) {
    if (res.status === 401) window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`;
    throw new Error(body.error ?? 'เกิดข้อผิดพลาด กรุณาลองอีกครั้ง');
  }
  return body;
}

export function baht(n: number): string {
  return `฿${n.toLocaleString('th-TH', { maximumFractionDigits: 2 })}`;
}

export interface Me {
  id: string;
  email: string;
  role: string;
  fullName: string;
}

interface SessionState {
  user: Me | null;
  ready: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

export const useSession = create<SessionState>((set) => ({
  user: null,
  ready: false,
  refresh: async () => {
    try {
      const { user } = await api<{ user: Me | null }>('/api/auth/me');
      set({ user, ready: true });
    } catch {
      set({ user: null, ready: true });
    }
  },
  logout: async () => {
    await api('/api/auth/logout', { method: 'POST' });
    set({ user: null });
    window.location.href = '/';
  },
}));

interface CartState {
  count: number;
  refresh: () => Promise<void>;
}

export const useCart = create<CartState>((set) => ({
  count: 0,
  refresh: async () => {
    try {
      const res = await fetch('/api/cart');
      if (!res.ok) {
        set({ count: 0 });
        return;
      }
      const data = (await res.json()) as { items: { quantity: number }[] };
      set({ count: data.items.reduce((s, i) => s + i.quantity, 0) });
    } catch {
      set({ count: 0 });
    }
  },
}));

export const STATUS_TH: Record<string, string> = {
  created: 'กำลังสร้าง',
  pending_payment: 'รอชำระเงิน',
  paid: 'ชำระแล้ว รอร้านรับ',
  restaurant_pending: 'รอร้านตอบรับ',
  restaurant_accepted: 'ร้านรับออเดอร์แล้ว',
  preparing: 'กำลังเตรียมอาหาร',
  ready_for_pickup: 'พร้อมส่ง',
  driver_assigned: 'มีไรเดอร์รับงาน',
  driver_arriving_restaurant: 'ไรเดอร์ใกล้ถึงร้าน',
  picked_up: 'ไรเดอร์รับอาหารแล้ว',
  delivering: 'กำลังจัดส่ง',
  delivered: 'ส่งถึงแล้ว',
  completed: 'สำเร็จ',
  cancelled: 'ยกเลิก',
  refunded: 'คืนเงินแล้ว',
};

export const STATUS_COLOR: Record<string, string> = {
  pending_payment: 'bg-[#FFC400] text-black',
  paid: 'bg-black text-[#FFC400]',
  restaurant_pending: 'bg-neutral-100 text-neutral-700',
  restaurant_accepted: 'bg-neutral-100 text-neutral-700',
  preparing: 'bg-neutral-100 text-neutral-700',
  ready_for_pickup: 'bg-neutral-100 text-neutral-700',
  driver_assigned: 'bg-neutral-100 text-neutral-700',
  picked_up: 'bg-neutral-100 text-neutral-700',
  delivering: 'bg-neutral-100 text-neutral-700',
  delivered: 'bg-black text-white',
  completed: 'bg-black text-white',
  cancelled: 'bg-red-50 text-red-600',
  refunded: 'bg-red-50 text-red-600',
};
