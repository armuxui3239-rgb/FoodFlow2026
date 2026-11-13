'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Banknote, Landmark, Plus, Star, Trash2 } from 'lucide-react';
import { api } from '@/lib/client';

interface BankRow {
  id: string;
  bankCode: string;
  bankName: string;
  accountNumber: string;
  accountHolderName: string;
  isDefault: boolean;
}

const BANKS = [
  { code: 'SCB', name: 'ไทยพาณิชย์ (SCB)' },
  { code: 'KBANK', name: 'กสิกรไทย (KBANK)' },
  { code: 'KTB', name: 'กรุงไทย (KTB)' },
  { code: 'BBL', name: 'กรุงเทพ (BBL)' },
  { code: 'TTB', name: 'ทหารไทยธนชาต (TTB)' },
  { code: 'BAY', name: 'กรุงศรีอยุธยา (BAY)' },
  { code: 'GSB', name: 'ออมสิน (GSB)' },
  { code: 'BAAC', name: 'เพื่อการเกษตร (BAAC)' },
];

/** หน้าบัญชีธนาคารของไรเดอร์ — รับโอนรายได้ (driver_bank_accounts จริง) */
export default function DriverBankPage() {
  const [rows, setRows] = useState<BankRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [bankCode, setBankCode] = useState('SCB');
  const [accountNumber, setAccountNumber] = useState('');
  const [holderName, setHolderName] = useState('');

  const load = useCallback(() => {
    api<{ data: BankRow[] }>('/api/driver/bank')
      .then((d) => {
        setRows(d.data);
        setError('');
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  const add = async () => {
    setBusy(true);
    setError('');
    try {
      const bank = BANKS.find((b) => b.code === bankCode);
      await api('/api/driver/bank', {
        method: 'POST',
        body: JSON.stringify({
          bankCode,
          bankName: bank?.name ?? bankCode,
          accountNumber,
          holderName,
        }),
      });
      setAccountNumber('');
      setHolderName('');
      setShowForm(false);
      load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const setDefault = async (id: string) => {
    setBusy(true);
    setError('');
    try {
      await api('/api/driver/bank', { method: 'PATCH', body: JSON.stringify({ id }) });
      load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (row: BankRow) => {
    if (!window.confirm(`ลบบัญชี ${row.bankName} · ${row.accountNumber}?`)) return;
    setBusy(true);
    setError('');
    try {
      await api(`/api/driver/bank?id=${encodeURIComponent(row.id)}`, { method: 'DELETE' });
      load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <header className="sticky top-0 z-40 border-b border-line bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-2 px-4">
          <Link
            href="/driver"
            aria-label="ย้อนกลับ"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-neutral-100 transition-transform active:scale-95"
          >
            <ArrowLeft className="h-5 w-5" aria-hidden />
          </Link>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#FFC400] text-black">
            <Landmark className="h-5 w-5" aria-hidden />
          </span>
          <h1 className="text-sm font-bold text-black">บัญชีธนาคารรับรายได้</h1>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 space-y-4 px-4 py-5">
        {error && <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}

        <p className="rounded-2xl bg-[#FFF4CC] px-4 py-3 text-xs leading-relaxed text-black">
          รายได้จากการจัดส่งจะโอนเข้าบัญชีที่ตั้งเป็น <b>ค่าเริ่มต้น</b> — เพิ่มได้สูงสุด 5 บัญชี
        </p>

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="h-20 animate-pulse rounded-3xl bg-neutral-100" />
            ))}
          </div>
        ) : rows.length === 0 && !showForm ? (
          <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-line px-4 py-12 text-center">
            <Banknote className="h-10 w-10 text-neutral-300" aria-hidden />
            <p className="text-sm text-neutral-400">ยังไม่มีบัญชีธนาคาร — เพิ่มบัญชีเพื่อรับรายได้</p>
          </div>
        ) : (
          <ul className="overflow-hidden rounded-3xl border border-line bg-white">
            {rows.map((r, i) => (
              <li key={r.id} className={`flex items-center gap-3 px-4 py-4 ${i > 0 ? 'border-t border-line' : ''}`}>
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#FFF4CC]">
                  <Landmark className="h-5 w-5 text-black" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate-1 text-sm font-bold text-black">
                    {r.bankName} {r.isDefault && <span className="ml-1 rounded-full bg-black px-2 py-0.5 text-[10px] font-bold text-[#FFC400]">ค่าเริ่มต้น</span>}
                  </p>
                  <p className="text-[11px] text-neutral-400">เจ้าของบัญชี {r.accountHolderName}</p>
                  <p className="text-xs font-medium tracking-wider text-neutral-600">•••• {r.accountNumber.slice(-4)}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {!r.isDefault && (
                    <button
                      onClick={() => void setDefault(r.id)}
                      disabled={busy}
                      aria-label="ตั้งเป็นบัญชีค่าเริ่มต้น"
                      className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-[#FFF4CC]"
                    >
                      <Star className="h-4.5 w-4.5 text-neutral-400" aria-hidden />
                    </button>
                  )}
                  <button
                    onClick={() => void remove(r)}
                    disabled={busy}
                    aria-label="ลบบัญชีนี้"
                    className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-red-50"
                  >
                    <Trash2 className="h-4.5 w-4.5 text-red-400" aria-hidden />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {showForm ? (
          <section aria-label="เพิ่มบัญชีใหม่" className="space-y-3 rounded-3xl border border-line bg-white p-4">
            <label className="block space-y-1">
              <span className="text-xs font-bold text-black">ธนาคาร</span>
              <select
                value={bankCode}
                onChange={(e) => setBankCode(e.target.value)}
                data-testid="bank-select"
                className="h-12 w-full rounded-2xl border border-line bg-white px-3 text-sm text-black"
              >
                {BANKS.map((b) => (
                  <option key={b.code} value={b.code}>{b.name}</option>
                ))}
              </select>
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-bold text-black">เลขบัญชี (8–16 หลัก)</span>
              <input
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value.replace(/[^\d\s-]/g, ''))}
                inputMode="numeric"
                maxLength={20}
                data-testid="bank-account-number"
                placeholder="เช่น 1234567890"
                className="h-12 w-full rounded-2xl border border-line bg-white px-3 text-sm text-black placeholder:text-neutral-300"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-bold text-black">ชื่อเจ้าของบัญชี</span>
              <input
                value={holderName}
                onChange={(e) => setHolderName(e.target.value)}
                maxLength={60}
                data-testid="bank-holder-name"
                placeholder="เช่น สมชาย ใจดี"
                className="h-12 w-full rounded-2xl border border-line bg-white px-3 text-sm text-black placeholder:text-neutral-300"
              />
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="h-12 flex-1 rounded-full border border-line bg-white text-sm font-semibold text-black"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={() => void add()}
                disabled={busy}
                data-testid="bank-save"
                className="btn-brand h-12 flex-1 text-sm disabled:opacity-50"
              >
                {busy ? 'กำลังบันทึก...' : 'บันทึกบัญชี'}
              </button>
            </div>
          </section>
        ) : (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            disabled={rows.length >= 5}
            data-testid="bank-add"
            className="btn-brand flex h-12 w-full items-center justify-center gap-2 text-sm disabled:opacity-50"
          >
            <Plus className="h-4.5 w-4.5" aria-hidden /> เพิ่มบัญชีธนาคาร
          </button>
        )}
      </main>

      <footer className="mt-auto border-t border-line bg-white pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-4 text-center text-xs text-neutral-400">
        © {new Date().getFullYear()} ฟู๊ด ธันเดอร์ — พอร์ทัลไรเดอร์
      </footer>
    </div>
  );
}
