'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, CircleAlert, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { api } from '@/lib/client';

interface ReasonRow {
  id: string;
  label: string;
  is_active: boolean;
  sort_order: number;
}

/** หน้าจัดการเหตุผลยกเลิก (แอดมิน) — เพิ่ม/แก้/ปิด/ลบ ลูกค้าจะเห็นตามที่ตั้งทันที (v4 ข้อ 8.11) */
export default function AdminCancelReasonsPage() {
  const [rows, setRows] = useState<ReasonRow[] | null>(null);
  const [newLabel, setNewLabel] = useState('');
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const r = await api<{ data: ReasonRow[] }>('/api/admin/cancel-reasons');
      setRows(r.data ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'โหลดข้อมูลไม่สำเร็จ');
      setRows([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const add = async () => {
    const label = newLabel.trim();
    if (label.length < 2) {
      setError('กรุณากรอกเหตุผลอย่างน้อย 2 ตัวอักษร');
      return;
    }
    setBusyId('new');
    setError('');
    try {
      await api('/api/admin/cancel-reasons', { method: 'POST', body: JSON.stringify({ label }) });
      setNewLabel('');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'เพิ่มไม่สำเร็จ');
    } finally {
      setBusyId('');
    }
  };

  const patch = async (id: string, body: { label?: string; isActive?: boolean }) => {
    setBusyId(id);
    setError('');
    try {
      await api(`/api/admin/cancel-reasons/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ');
    } finally {
      setBusyId('');
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm('ลบเหตุผลนี้ถาวร?')) return;
    setBusyId(id);
    setError('');
    try {
      await api(`/api/admin/cancel-reasons/${id}`, { method: 'DELETE' });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ลบไม่สำเร็จ');
    } finally {
      setBusyId('');
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <header className="sticky top-0 z-40 border-b border-line bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-2 px-4">
          <div className="flex min-w-0 items-center gap-2">
            <Link
              href="/admin"
              aria-label="ย้อนกลับ"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-neutral-100 transition-transform active:scale-95"
            >
              <ArrowLeft className="h-5 w-5" aria-hidden />
            </Link>
            <div className="min-w-0">
              <p className="truncate-1 text-sm font-bold text-black">เหตุผลยกเลิกคำสั่งซื้อ</p>
              <p className="truncate-1 text-[11px] text-neutral-400">ลูกค้าจะเห็นเฉพาะเหตุผลที่เปิดใช้งาน</p>
            </div>
          </div>
          <button
            onClick={() => void load()}
            aria-label="รีเฟรช"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full hover:bg-neutral-100"
          >
            <RefreshCw className="h-5 w-5 text-neutral-500" aria-hidden />
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 space-y-5 px-4 py-5">
        {error && (
          <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </p>
        )}

        <section aria-label="เพิ่มเหตุผลใหม่" className="rounded-3xl border border-line bg-white p-4">
          <p className="mb-2 text-sm font-bold text-black">เพิ่มเหตุผลใหม่</p>
          <div className="flex gap-2">
            <input
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="เช่น อาหารมาช้า"
              className="min-w-0 flex-1 h-11 rounded-2xl border border-line bg-neutral-50 px-4 text-sm outline-none focus:border-[#FFC400]"
            />
            <button
              type="button"
              onClick={() => void add()}
              disabled={busyId === 'new' || newLabel.trim().length < 2}
              className="btn-brand inline-flex h-11 items-center gap-1.5 px-5 text-sm"
            >
              <Plus className="h-4 w-4" aria-hidden /> เพิ่ม
            </button>
          </div>
        </section>

        {rows === null ? (
          <div className="h-56 animate-pulse rounded-3xl bg-neutral-100" />
        ) : (
          <div className="overflow-hidden rounded-3xl border border-line bg-white">
            {rows.map((r) => (
              <div key={r.id} className="flex items-center gap-3 border-t border-line px-4 py-3 first:border-t-0">
                <input
                  defaultValue={r.label}
                  onBlur={(e) => {
                    const v = e.target.value.trim();
                    if (v && v !== r.label) void patch(r.id, { label: v });
                  }}
                  aria-label={`แก้ไขเหตุผล ${r.label}`}
                  className="min-w-0 flex-1 h-10 rounded-2xl border border-line bg-neutral-50 px-4 text-sm outline-none focus:border-[#FFC400]"
                />
                <button
                  type="button"
                  onClick={() => void patch(r.id, { isActive: !r.is_active })}
                  disabled={busyId === r.id}
                  aria-label={r.is_active ? 'ปิดใช้งาน' : 'เปิดใช้งาน'}
                  className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-bold transition-colors ${
                    r.is_active
                      ? 'bg-black text-[#FFC400] hover:bg-black/90'
                      : 'bg-neutral-100 text-neutral-500 hover:bg-neutral-200'
                  }`}
                >
                  {r.is_active ? 'เปิดใช้งาน' : 'ปิดอยู่'}
                </button>
                <button
                  type="button"
                  onClick={() => void remove(r.id)}
                  disabled={busyId === r.id}
                  aria-label={`ลบเหตุผล ${r.label}`}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-red-200 bg-white text-red-600 hover:bg-red-50 disabled:opacity-50"
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </button>
              </div>
            ))}
          </div>
        )}

        <p className="text-xs leading-relaxed text-neutral-400">
          แตะช่องข้อความเพื่อแก้ไข แล้วกดออกนอกช่องเพื่อบันทึก · "ปิดอยู่" = ลูกค้าจะไม่เห็นเหตุผลนี้ตอนยกเลิก
        </p>
      </main>
    </div>
  );
}
