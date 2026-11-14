'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Bike,
  ClipboardList,
  RefreshCw,
  Star,
  Store,
  Users,
} from 'lucide-react';
import { api, baht, STATUS_TH } from '@/lib/client';
import { AdminFooter, AdminHeader } from '@/components/portal/admin-header';

interface Stats {
  users: { total: number; byRole: Record<string, number>; active: number };
  restaurants: { total: number; approved: number; open: number };
  orders: { total: number; byStatus: Record<string, number>; today: number; gmvTodaySatang: number };
  drivers: { total: number; online: number };
}

interface AdminOrder {
  id: string;
  order_code: string;
  status: string;
  total: number;
  created_at: string;
  restaurantName: string;
  customerName: string;
}

interface AdminRestaurant {
  id: string;
  name: string;
  slug: string;
  is_open: boolean;
  is_active: boolean;
  approval_status: string;
  rating: number | null;
  total_reviews: number | null;
  ownerEmail: string | null;
  ownerName: string | null;
}

/** หน้าผู้ดูแลระบบ — ภาพรวมทั้งระบบแบบเรียลไทม์ (ดึงใหม่ทุก 20 วินาที) */
export default function AdminPortalPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [restaurants, setRestaurants] = useState<AdminRestaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tick, setTick] = useState(0);

  const load = useCallback(() => {
    Promise.all([
      api<Stats>('/api/admin/stats'),
      api<{ data: AdminOrder[] }>('/api/admin/orders?limit=30'),
      api<{ data: AdminRestaurant[] }>('/api/admin/restaurants'),
    ])
      .then(([s, o, r]) => {
        setStats(s);
        setOrders(o.data);
        setRestaurants(r.data);
        setError('');
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load, tick]);

  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 20000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <AdminHeader />

      <main className="mx-auto w-full max-w-5xl flex-1 space-y-6 px-4 py-5">
        {/* หัวข้อหน้า + ปุ่มรีเฟรช */}
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-lg font-bold text-black">ภาพรวมทั้งระบบ</h1>
          <button
            onClick={() => { setLoading(true); setTick((x) => x + 1); }}
            className="flex items-center gap-1.5 rounded-full border border-line px-3 py-2 text-xs font-semibold text-neutral-600 transition-colors hover:bg-neutral-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} aria-hidden /> รีเฟรช
          </button>
        </div>

        {error && (
          <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </p>
        )}

        {/* การ์ดสถิติรวม */}
        <section aria-label="ภาพรวมระบบ" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            { label: 'ผู้ใช้ทั้งหมด', value: stats ? String(stats.users.total) : '–', sub: stats ? `ลูกค้า ${stats.users.byRole.customer ?? 0} · ร้าน ${stats.users.byRole.restaurant ?? 0} · ไรเดอร์ ${stats.users.byRole.driver ?? 0} · แอดมิน ${stats.users.byRole.admin ?? 0}` : '', Icon: Users },
            { label: 'ร้านอาหาร', value: stats ? `${stats.restaurants.open}/${stats.restaurants.total}` : '–', sub: stats ? `เปิด ${stats.restaurants.open} ร้าน · อนุมัติ ${stats.restaurants.approved} ร้าน` : '', Icon: Store },
            { label: 'ออเดอร์วันนี้', value: stats ? String(stats.orders.today) : '–', sub: stats ? `ยอดขายวันนี้ ${baht(stats.orders.gmvTodaySatang)}` : '', Icon: ClipboardList },
            { label: 'ไรเดอร์ออนไลน์', value: stats ? `${stats.drivers.online}/${stats.drivers.total}` : '–', sub: stats ? `รวมทุกคน ${stats.drivers.total} คน` : '', Icon: Bike },
          ].map(({ label, value, sub, Icon }) => (
            <div key={label} className="rounded-3xl border border-line bg-white p-4 shadow-sm">
              <Icon className="h-5 w-5 text-black" aria-hidden />
              <p className="mt-2 text-2xl font-bold text-black">{value}</p>
              <p className="text-xs font-semibold text-neutral-600">{label}</p>
              <p className="mt-0.5 truncate-1 text-[11px] text-neutral-400">{sub}</p>
            </div>
          ))}
        </section>

        {/* ออเดอร์ล่าสุด */}
        <section aria-label="ออเดอร์ล่าสุด">
          <h2 className="mb-2 text-sm font-bold text-black">ออเดอร์ล่าสุด</h2>
          <div className="max-h-96 overflow-y-auto ft-scroll rounded-3xl border border-line bg-white">
            {loading ? (
              <div className="space-y-2 p-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-10 animate-pulse rounded-2xl bg-neutral-100" />
                ))}
              </div>
            ) : (
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 bg-[#FFF4CC] text-xs text-neutral-600">
                  <tr>
                    <th className="px-4 py-2.5 font-bold">รหัส</th>
                    <th className="px-4 py-2.5 font-bold">ร้าน</th>
                    <th className="hidden px-4 py-2.5 font-bold sm:table-cell">ลูกค้า</th>
                    <th className="px-4 py-2.5 font-bold">สถานะ</th>
                    <th className="px-4 py-2.5 text-right font-bold">ยอด</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => (
                    <tr key={o.id} className="border-t border-line">
                      <td className="px-4 py-2.5 text-xs font-bold text-black">{o.order_code}</td>
                      <td className="max-w-40 truncate-1 px-4 py-2.5">{o.restaurantName}</td>
                      <td className="hidden max-w-32 truncate-1 px-4 py-2.5 text-neutral-500 sm:table-cell">{o.customerName}</td>
                      <td className="px-4 py-2.5">
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                          o.status === 'paid' ? 'bg-[#FFC400] text-black' : ['delivered', 'completed'].includes(o.status) ? 'bg-black text-[#FFC400]' : o.status === 'cancelled' ? 'bg-red-50 text-red-600' : 'bg-neutral-100 text-neutral-700'
                        }`}>
                          {STATUS_TH[o.status] ?? o.status}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right font-bold text-black">{baht(o.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

        {/* ร้านทั้งหมด */}
        <section aria-label="ร้านอาหารทั้งหมด">
          <h2 className="mb-2 text-sm font-bold text-black">ร้านอาหารทั้งหมด ({restaurants.length})</h2>
          <div className="max-h-96 overflow-y-auto ft-scroll rounded-3xl border border-line bg-white">
            <ul className="divide-y divide-line">
              {restaurants.map((r) => (
                <li key={r.id} className="flex items-center gap-3 px-4 py-3">
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${r.is_open ? 'bg-[#FFF4CC]' : 'bg-neutral-100'}`}>
                    <Store className={`h-4.5 w-4.5 ${r.is_open ? 'text-black' : 'text-neutral-300'}`} aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate-1 text-sm font-bold text-black">{r.name}</p>
                    <p className="truncate-1 text-[11px] text-neutral-400">
                      เจ้าของ: {r.ownerName ?? 'ไม่ระบุ'} ({r.ownerEmail ?? '-'} · slug {r.slug})
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="flex items-center justify-end gap-1 text-xs font-bold text-black">
                      <Star className="h-3.5 w-3.5 fill-[#FFC400] stroke-black" aria-hidden />
                      {(r.rating ?? 0).toFixed(1)} <span className="font-normal text-neutral-400">({r.total_reviews ?? 0})</span>
                    </p>
                    <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${r.is_open ? 'bg-black text-[#FFC400]' : 'bg-neutral-100 text-neutral-500'}`}>
                      {r.is_open ? 'เปิดอยู่' : 'ปิดแล้ว'}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>

      <AdminFooter />
    </div>
  );
}
