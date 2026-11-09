'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Ban, Search, ShieldCheck, Users } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { api } from '@/lib/client';

interface UserRow {
  id: string;
  email: string;
  phone: string | null;
  full_name: string;
  role: string;
  is_active: boolean;
  created_at: string;
}

const ROLE_TH: Record<string, string> = {
  customer: 'ลูกค้า',
  restaurant: 'เจ้าของร้าน',
  driver: 'ไรเดอร์',
  admin: 'ผู้ดูแลระบบ',
};

/** หน้าจัดการผู้ใช้ (แอดมิน) — ค้นหา + เปิด/ระงับบัญชีจริง */
export default function AdminUsersPage() {
  const [rows, setRows] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [role, setRole] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    const p = new URLSearchParams();
    if (q.trim()) p.set('q', q.trim());
    if (role) p.set('role', role);
    api<{ data: UserRow[] }>(`/api/admin/users?${p.toString()}`)
      .then((d) => setRows(d.data))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [q, role]);

  useEffect(() => {
    const t = setTimeout(load, q ? 350 : 0);
    return () => clearTimeout(t);
  }, [load, q]);

  const toggle = async (u: UserRow, next: boolean) => {
    setBusyId(u.id);
    setError('');
    try {
      await api('/api/admin/users', { method: 'PATCH', body: JSON.stringify({ userId: u.id, isActive: next }) });
      setRows((rs) => rs.map((r) => (r.id === u.id ? { ...r, is_active: next } : r)));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <header className="sticky top-0 z-40 border-b border-line bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-2 px-4">
          <Link
            href="/admin"
            aria-label="ย้อนกลับ"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-neutral-100 transition-transform active:scale-95"
          >
            <ArrowLeft className="h-5 w-5" aria-hidden />
          </Link>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-black text-[#FFC400]">
            <Users className="h-5 w-5" aria-hidden />
          </span>
          <h1 className="text-sm font-bold text-black">จัดการผู้ใช้ ({rows.length})</h1>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 space-y-4 px-4 py-5">
        {error && <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}

        {/* ค้นหา + กรองบทบาท */}
        <search className="flex h-11 items-center gap-2 rounded-full bg-neutral-100 px-4">
          <Search className="h-4 w-4 shrink-0 text-neutral-400" aria-hidden />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="ค้นหาชื่อ อีเมล หรือเบอร์โทร"
            aria-label="ค้นหาผู้ใช้"
            className="h-full w-full bg-transparent text-sm outline-none placeholder:text-neutral-400"
          />
        </search>
        <div className="flex gap-2" role="group" aria-label="กรองบทบาท">
          {['', 'customer', 'restaurant', 'driver', 'admin'].map((r) => (
            <button
              key={r || 'all'}
              onClick={() => setRole(r)}
              aria-pressed={role === r}
              className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition-all active:scale-95 ${
                role === r ? 'bg-black text-[#FFC400]' : 'bg-neutral-100 text-neutral-600 hover:bg-[#FFF4CC]'
              }`}
            >
              {r === '' ? 'ทั้งหมด' : ROLE_TH[r]}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-3xl bg-neutral-100" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <p className="rounded-3xl border border-dashed border-line px-4 py-10 text-center text-sm text-neutral-300">ไม่พบผู้ใช้</p>
        ) : (
          <ul className="overflow-hidden rounded-3xl border border-line bg-white">
            {rows.map((u, i) => (
              <li key={u.id} className={`flex items-center gap-3 px-4 py-3 ${i > 0 ? 'border-t border-line' : ''}`}>
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold ${u.is_active ? 'bg-[#FFF4CC] text-black' : 'bg-red-50 text-red-500'}`}>
                  {u.full_name?.slice(0, 1) ?? '?'}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate-1 text-sm font-bold text-black">{u.full_name}</p>
                  <p className="truncate-1 text-[11px] text-neutral-400">
                    {ROLE_TH[u.role] ?? u.role} · {u.email}
                    {u.phone ? ` · ${u.phone}` : ''}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {u.is_active ? (
                    <ShieldCheck className="h-4 w-4 text-black" aria-label="บัญชีปกติ" />
                  ) : (
                    <Ban className="h-4 w-4 text-red-400" aria-label="บัญชีถูกระงับ" />
                  )}
                  <Switch
                    checked={u.is_active}
                    disabled={busyId === u.id}
                    onCheckedChange={(v) => void toggle(u, v)}
                    aria-label={`${u.is_active ? 'ระงับ' : 'เปิด'} บัญชี ${u.full_name}`}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>

      <footer className="mt-auto border-t border-line bg-white pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-4 text-center text-xs text-neutral-400">
        © {new Date().getFullYear()} ฟู๊ด ธันเดอร์ — ศูนย์ควบคุมผู้ดูแลระบบ
      </footer>
    </div>
  );
}
