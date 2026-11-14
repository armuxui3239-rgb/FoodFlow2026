'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/client';

interface BankInfo {
  bank_name: string | null;
  bank_account_number: string | null;
  bank_account_name: string | null;
}

/** ส่วนบัญชีธนาคารรับรายได้ของร้าน (ฝั่งแอดมิน) — แก้ได้ + audit log อัตโนมัติ
 *  (GET รวมอยู่ใน /api/admin/restaurants/[id] · PATCH ผ่าน endpoint เดียวกัน) */
export function AdminRestaurantBankSection({ restaurantId }: { restaurantId: string }) {
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [holderName, setHolderName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api<{ restaurant: BankInfo }>(`/api/admin/restaurants/${restaurantId}`)
      .then((r) => {
        setBankName(r.restaurant?.bank_name ?? '');
        setAccountNumber(r.restaurant?.bank_account_number ?? '');
        setHolderName(r.restaurant?.bank_account_name ?? '');
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [restaurantId]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    setSaving(true);
    setMsg('');
    setError('');
    try {
      await api(`/api/admin/restaurants/${restaurantId}`, {
        method: 'PATCH',
        body: JSON.stringify({ bankName, accountNumber, holderName }),
      });
      setMsg('บันทึกบัญชีธนาคารร้านเรียบร้อย (+audit log)');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section aria-label="บัญชีธนาคารรับรายได้ของร้าน" className="space-y-3 rounded-3xl border border-line bg-white p-4">
      <p className="text-sm font-bold text-black">บัญชีธนาคารรับรายได้ (แอดมินแก้ได้)</p>
      {loading ? (
        <div className="h-32 animate-pulse rounded-2xl bg-neutral-100" />
      ) : (
        <>
          {msg && <p role="status" className="rounded-2xl bg-[#FFF4CC] px-4 py-3 text-sm text-black">{msg}</p>}
          {error && <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block space-y-1">
              <span className="text-[11px] font-bold text-black">ธนาคาร</span>
              <input
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                aria-label="ชื่อธนาคารของร้าน"
                className="h-11 w-full rounded-2xl border border-line bg-neutral-50 px-4 text-sm outline-none focus:border-[#FFC400]"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-[11px] font-bold text-black">เลขบัญชี</span>
              <input
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value.replace(/[^\d\s-]/g, ''))}
                inputMode="numeric"
                aria-label="เลขบัญชีธนาคารของร้าน"
                className="h-11 w-full rounded-2xl border border-line bg-neutral-50 px-4 text-sm tabular-nums outline-none focus:border-[#FFC400]"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-[11px] font-bold text-black">ชื่อเจ้าของบัญชี</span>
              <input
                value={holderName}
                onChange={(e) => setHolderName(e.target.value)}
                aria-label="ชื่อเจ้าของบัญชีธนาคารของร้าน"
                className="h-11 w-full rounded-2xl border border-line bg-neutral-50 px-4 text-sm outline-none focus:border-[#FFC400]"
              />
            </label>
          </div>
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving}
            className="btn-brand h-11 w-full text-sm"
          >
            {saving ? 'กำลังบันทึก…' : 'บันทึกบัญชีธนาคารร้าน'}
          </button>
        </>
      )}
    </section>
  );
}
