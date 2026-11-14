'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/client';

interface BankInfo {
  bank_name: string | null;
  bank_account_number: string | null;
  bank_account_name: string | null;
}

/** ส่วนบัญชีธนาคารรับรายได้ของร้าน — เจ้าของจัดการเอง (GET/PATCH /api/owner/bank) */
export function RestaurantBankSection() {
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [holderName, setHolderName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api<{ data: BankInfo }>('/api/owner/bank')
      .then((r) => {
        setBankName(r.data?.bank_name ?? '');
        setAccountNumber(r.data?.bank_account_number ?? '');
        setHolderName(r.data?.bank_account_name ?? '');
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    setSaving(true);
    setMsg('');
    setError('');
    try {
      await api('/api/owner/bank', {
        method: 'PATCH',
        body: JSON.stringify({ bankName, accountNumber, holderName }),
      });
      setMsg('บันทึกบัญชีธนาคารเรียบร้อย');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section aria-label="บัญชีธนาคารรับรายได้" className="space-y-3 rounded-3xl border border-line bg-white p-4">
      <div>
        <p className="text-sm font-bold text-black">บัญชีธนาคารรับรายได้</p>
        <p className="text-[11px] text-neutral-400">ศูนย์ควบคุมจะโอนรายได้เข้าบัญชีนี้ — แก้ไขได้ทุกเมื่อ</p>
      </div>
      {loading ? (
        <div className="h-40 animate-pulse rounded-2xl bg-neutral-100" />
      ) : (
        <>
          {msg && <p role="status" className="rounded-2xl bg-[#FFF4CC] px-4 py-3 text-sm text-black">{msg}</p>}
          {error && <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}
          <label className="block space-y-1">
            <span className="text-xs font-bold text-black">ชื่อธนาคาร</span>
            <input
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
              placeholder="เช่น ธนาคารกรุงเทพ"
              aria-label="ชื่อธนาคาร"
              className="h-11 w-full rounded-2xl border border-line bg-neutral-50 px-4 text-sm outline-none focus:border-[#FFC400]"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-bold text-black">เลขบัญชี (8–16 หลัก)</span>
            <input
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value.replace(/[^\d\s-]/g, ''))}
              inputMode="numeric"
              placeholder="เช่น 1234567890"
              aria-label="เลขบัญชีธนาคาร"
              className="h-11 w-full rounded-2xl border border-line bg-neutral-50 px-4 text-sm tabular-nums outline-none focus:border-[#FFC400]"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-bold text-black">ชื่อเจ้าของบัญชี</span>
            <input
              value={holderName}
              onChange={(e) => setHolderName(e.target.value)}
              placeholder="เช่น ร้านอาหารตัวอย่าง จำกัด"
              aria-label="ชื่อเจ้าของบัญชี"
              className="h-11 w-full rounded-2xl border border-line bg-neutral-50 px-4 text-sm outline-none focus:border-[#FFC400]"
            />
          </label>
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving}
            className="btn-brand h-11 w-full text-sm"
          >
            {saving ? 'กำลังบันทึก…' : 'บันทึกบัญชีธนาคาร'}
          </button>
        </>
      )}
    </section>
  );
}
