'use client';

import Link from 'next/link';
import { useState } from 'react';
import {
  BadgeCheck,
  CircleAlert,
  ChevronLeft,
  Landmark,
  QrCode,
  Wallet,
} from 'lucide-react';
import { api, baht } from '@/lib/client';

const QUICK_AMOUNTS = [50, 100, 200, 300, 500, 1000];

interface TopupResult {
  transactionId: string;
  qrDataUrl: string;
  amount: number;
}

export default function WalletTopupPage() {
  const [amount, setAmount] = useState('');
  const [step, setStep] = useState<'form' | 'qr' | 'success'>('form');
  const [qr, setQr] = useState<TopupResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState('');

  const parsedAmount = Number(amount);

  // ขั้นที่ 1: สร้างรายการเติมเงิน + รับคิวอาร์โค้ด
  const continueToQr = async () => {
    setError('');
    if (!QUICK_AMOUNTS.includes(parsedAmount)) {
      setError('กรุณาเลือกจำนวนเงินจากปุ่มด่วน หรือพิมพ์ 50, 100, 200, 300, 500 หรือ 1,000 บาท');
      return;
    }
    setSubmitting(true);
    try {
      const r = await api<{ data: TopupResult }>('/api/wallet/topup', {
        method: 'POST',
        body: JSON.stringify({ amount: parsedAmount }),
      });
      setQr(r.data);
      setStep('qr');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'สร้างรายการเติมเงินไม่สำเร็จ');
    } finally {
      setSubmitting(false);
    }
  };

  // ขั้นที่ 2: จำลองการชำระเงินสำเร็จ (โหมดทดสอบ)
  const confirmSimulate = async () => {
    if (!qr) return;
    setError('');
    setConfirming(true);
    try {
      await api('/api/wallet/topup', {
        method: 'PATCH',
        body: JSON.stringify({ transactionId: qr.transactionId }),
      });
      setStep('success');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ยืนยันการชำระเงินไม่สำเร็จ');
    } finally {
      setConfirming(false);
    }
  };

  // สถานะสำเร็จ — ตามต้นแบบ Top Up Successful
  if (step === 'success' && qr) {
    return (
      <div className="py-4">
        <section className="flex flex-col items-center gap-4 rounded-3xl border border-line bg-white px-6 py-10 text-center">
          <span className="flex h-20 w-20 items-center justify-center rounded-full bg-[#FFF4CC]">
            <BadgeCheck className="h-10 w-10 text-[#FFC400]" aria-hidden />
          </span>
          <h1 className="text-xl font-bold text-black">เติมเงินสำเร็จ</h1>
          <p className="text-sm text-neutral-400">
            เพิ่ม {baht(qr.amount)} เข้ากระเป๋าเงินเรียบร้อยแล้ว
          </p>
          <Link
            href="/wallet"
            data-testid="topup-back-wallet"
            className="btn-brand mt-2 inline-flex h-12 items-center gap-2 px-8 text-sm"
          >
            <Wallet className="h-4 w-4" aria-hidden />
            กลับไปที่กระเป๋าเงิน
          </Link>
        </section>
        <p className="mt-4 flex items-start justify-center gap-1.5 text-xs text-neutral-400">
          <Landmark className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          การชำระเงินจริงจะยืนยันผ่านระบบธนาคารเมื่อเปิดใช้งาน
        </p>
      </div>
    );
  }

  // สถานะคิวอาร์โค้ด — สแกนเพื่อชำระ
  if (step === 'qr' && qr) {
    return (
      <div className="space-y-5">
        <Link href="/wallet" className="inline-flex h-11 items-center gap-1 text-sm font-semibold text-black">
          <ChevronLeft className="h-4 w-4" aria-hidden />
          ย้อนกลับ
        </Link>

        <section
          aria-label="คิวอาร์โค้ดชำระเงิน"
          className="flex flex-col items-center gap-3 rounded-3xl border border-line bg-white p-6"
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-black text-[#FFC400]">
            <QrCode className="h-6 w-6" aria-hidden />
          </span>
          <h1 className="text-lg font-bold text-black">สแกนเพื่อเติมเงิน</h1>
          <p className="text-xs text-neutral-400">ยอดเติมเงิน</p>
          <p className="text-3xl font-bold tabular-nums text-black" data-testid="topup-amount-display">
            {baht(qr.amount)}
          </p>
          <img
            src={qr.qrDataUrl}
            alt={`คิวอาร์โค้ดพร้อมเพย์สำหรับเติมเงิน ${baht(qr.amount)}`}
            className="h-64 w-64 rounded-2xl border border-line"
          />
          <p className="text-xs text-neutral-400">เปิดแอปธนาคารแล้วสแกนคิวอาร์โค้ดนี้เพื่อชำระเงิน</p>
        </section>

        {error && (
          <p role="alert" className="flex items-start gap-2 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">
            <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={() => void confirmSimulate()}
          disabled={confirming}
          data-testid="topup-simulate"
          className="btn-brand h-12 w-full text-sm"
        >
          {confirming ? 'กำลังยืนยัน…' : 'จำลองการชำระเงินสำเร็จ (โหมดทดสอบ)'}
        </button>

        <p className="flex items-start gap-1.5 text-xs text-neutral-400">
          <Landmark className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          การชำระเงินจริงจะยืนยันผ่านระบบธนาคารเมื่อเปิดใช้งาน
        </p>
      </div>
    );
  }

  // สถานะฟอร์ม — กรอกจำนวนเงิน + ปุ่มยอดด่วน
  return (
    <div className="space-y-5">
      <Link href="/wallet" className="inline-flex h-11 items-center gap-1 text-sm font-semibold text-black">
        <ChevronLeft className="h-4 w-4" aria-hidden />
        ย้อนกลับ
      </Link>

      <header>
        <h1 className="text-xl font-bold text-black">เติมเงินเข้ากระเป๋า</h1>
        <p className="mt-1 text-sm text-neutral-400">เลือกหรือพิมพ์จำนวนเงินที่ต้องการเติม</p>
      </header>

      <section aria-label="จำนวนเงิน" className="space-y-3">
        <label htmlFor="topup-amount" className="text-sm font-medium text-black">
          จำนวนเงิน (บาท)
        </label>
        <input
          id="topup-amount"
          type="number"
          inputMode="numeric"
          min={0}
          step={1}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0"
          data-testid="topup-amount-input"
          className="h-14 w-full rounded-2xl border border-line bg-neutral-50 px-4 text-lg font-bold tabular-nums outline-none focus:border-black"
        />
        <div className="grid grid-cols-3 gap-3">
          {QUICK_AMOUNTS.map((v) => {
            const selected = parsedAmount === v;
            return (
              <button
                key={v}
                type="button"
                onClick={() => {
                  setAmount(String(v));
                  setError('');
                }}
                aria-pressed={selected}
                className={`h-11 rounded-2xl border text-sm font-bold tabular-nums transition-colors ${
                  selected
                    ? 'border-black bg-[#FFF4CC] text-black'
                    : 'border-line bg-white text-black hover:border-neutral-300'
                }`}
              >
                {v.toLocaleString('th-TH')}
              </button>
            );
          })}
        </div>
      </section>

      {error && (
        <p role="alert" className="flex items-start gap-2 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={() => void continueToQr()}
        disabled={submitting || !amount}
        data-testid="topup-continue"
        className="btn-brand h-12 w-full text-sm"
      >
        {submitting ? 'กำลังสร้างคิวอาร์โค้ด…' : 'ดำเนินการต่อ'}
      </button>

      <p className="flex items-start gap-1.5 text-xs text-neutral-400">
        <Landmark className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
        การชำระเงินจริงจะยืนยันผ่านระบบธนาคารเมื่อเปิดใช้งาน
      </p>
    </div>
  );
}
