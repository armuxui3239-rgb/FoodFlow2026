'use client';

import Link from 'next/link';
import { useState } from 'react';
import {
  BadgeCheck,
  CircleAlert,
  ChevronLeft,
  Landmark,
  LockKeyhole,
  QrCode,
  Wallet,
} from 'lucide-react';
import { api, baht } from '@/lib/client';

/** ยอดเติมเงินลัดตามข้อ 8.12 + พิมพ์เองได้ (เซิร์ฟเวอร์ตรวจ 1–50,000 อีกชั้น) */
const QUICK_AMOUNTS = [100, 200, 300, 500, 1000, 2000];

interface TopupResult {
  transactionId: string;
  qrDataUrl: string;
  amount: number;
}

export default function WalletTopupPage() {
  const [amount, setAmount] = useState('');
  const [step, setStep] = useState<'form' | 'pin' | 'qr' | 'sent'>('form');
  const [pin, setPin] = useState('');
  const [qr, setQr] = useState<TopupResult | null>(null);
  const [slipFile, setSlipFile] = useState<File | null>(null);
  const [slipPreview, setSlipPreview] = useState('');
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState('');

  const parsedAmount = Number(amount);

  // ขั้นที่ 1: ตรวจรูปแบบยอด แล้วไปขั้นยืนยัน PIN (v4 ข้อ 4.5 — ตรวจฝั่ง backend)
  const continueToPin = () => {
    setError('');
    if (!Number.isInteger(parsedAmount) || parsedAmount < 1 || parsedAmount > 50000) {
      setError('กรุณาเลือกยอดลัด หรือพิมพ์จำนวนเต็ม 1–50,000 บาท');
      return;
    }
    setPin('');
    setStep('pin');
  };

  // ขั้นที่ 2: ยืนยัน PIN แล้วสร้างรายการ + รับคิวอาร์โค้ด
  const verifyPinAndCreate = async () => {
    setError('');
    if (!/^\d{6}$/.test(pin)) {
      setError('กรุณากรอก PIN 6 หลัก');
      return;
    }
    setVerifying(true);
    try {
      await api('/api/auth/verify-pin', { method: 'POST', body: JSON.stringify({ pin }) });
      const r = await api<{ data: TopupResult }>('/api/wallet/topup', {
        method: 'POST',
        body: JSON.stringify({ amount: parsedAmount }),
      });
      setQr(r.data);
      setStep('qr');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ยืนยัน PIN ไม่สำเร็จ');
    } finally {
      setVerifying(false);
    }
  };

  const pickSlip = (file: File | null) => {
    setError('');
    if (!file) {
      setSlipFile(null);
      setSlipPreview('');
      return;
    }
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setError('รองรับเฉพาะไฟล์ภาพ PNG/JPG/WEBP');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('ไฟล์ใหญ่เกิน 5MB');
      return;
    }
    setSlipFile(file);
    setSlipPreview(URL.createObjectURL(file));
  };

  // ขั้นที่ 3: อัปโหลดสลิป -> รอแอดมินตรวจ
  const submitSlip = async () => {
    if (!qr || !slipFile) return;
    setError('');
    setUploading(true);
    try {
      const form = new FormData();
      form.append('transactionId', qr.transactionId);
      form.append('slip', slipFile);
      const res = await fetch('/api/wallet/topup/slip', { method: 'POST', body: form });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error ?? 'แนบสลิปไม่สำเร็จ');
      }
      setStep('sent');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'แนบสลิปไม่สำเร็จ');
    } finally {
      setUploading(false);
    }
  };

  // ทางลัดโหมดทดสอบ (backend ปิดใน production)
  const confirmSimulate = async () => {
    if (!qr) return;
    setError('');
    try {
      await api('/api/wallet/topup', {
        method: 'PATCH',
        body: JSON.stringify({ transactionId: qr.transactionId }),
      });
      setSlipFile(null);
      setSlipPreview('');
      setStep('sent');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ยืนยันการชำระเงินไม่สำเร็จ');
    }
  };

  // ขั้นที่ 4: ส่งสลิปแล้ว — รอแอดมินตรวจ
  if (step === 'sent' && qr) {
    return (
      <div className="py-4">
        <section className="flex flex-col items-center gap-4 rounded-3xl border border-line bg-white px-6 py-10 text-center">
          <span className="flex h-20 w-20 items-center justify-center rounded-full bg-[#FFF4CC]">
            <BadgeCheck className="h-10 w-10 text-[#FFC400]" aria-hidden />
          </span>
          <h1 className="text-xl font-bold text-black" data-testid="topup-back-wallet-label">
            ส่งสลิปเรียบร้อยแล้ว
          </h1>
          <p className="text-sm text-neutral-400">
            ยอด {baht(qr.amount)} จะเข้ากระเป๋าเงินเมื่อผู้ดูแลตรวจสลิปและอนุมัติ
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
      </div>
    );
  }

  // ขั้นที่ 3: คิวอาร์โค้ด + แนบสลิป
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
          <p className="text-xs text-neutral-400">เปิดแอปธนาคารแล้วสแกนคิวอาร์โค้ดนี้เพื่อโอนเงิน</p>
        </section>

        <section aria-label="แนบสลิป" className="space-y-3 rounded-3xl border border-line bg-white p-5">
          <h2 className="text-base font-bold text-black">โอนเงินแล้ว? แนบสลิปเพื่อยืนยัน</h2>
          <p className="text-xs text-neutral-400">
            ผู้ดูแลระบบจะตรวจสลิปและอนุมัติยอดเข้ากระเป๋าเงินของคุณ
          </p>
          {slipPreview && (
            <img
              src={slipPreview}
              alt="ตัวอย่างสลิปที่เลือก"
              className="max-h-64 w-full rounded-2xl border border-line object-contain"
            />
          )}
          <label
            htmlFor="topup-slip-input"
            className="flex h-11 cursor-pointer items-center justify-center rounded-full border border-line bg-white text-sm font-semibold text-black hover:bg-neutral-50"
          >
            {slipFile ? 'เลือกไฟล์อื่น' : 'เลือกไฟล์สลิป (PNG/JPG/WEBP)'}
          </label>
          <input
            id="topup-slip-input"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => pickSlip(e.target.files?.[0] ?? null)}
          />
          <button
            type="button"
            onClick={() => void submitSlip()}
            disabled={uploading || !slipFile}
            data-testid="topup-submit-slip"
            className="btn-brand h-12 w-full text-sm"
          >
            {uploading ? 'กำลังส่งสลิป…' : 'ส่งสลิปเพื่อตรวจสอบ'}
          </button>
          <button
            type="button"
            onClick={() => void confirmSimulate()}
            data-testid="topup-simulate"
            className="h-9 w-full text-xs text-neutral-400 underline"
          >
            จำลองการชำระเงินสำเร็จ (โหมดทดสอบเท่านั้น)
          </button>
        </section>

        {error && (
          <p role="alert" className="flex items-start gap-2 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">
            <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            {error}
          </p>
        )}
      </div>
    );
  }

  // ขั้นที่ 2: ยืนยัน PIN
  if (step === 'pin') {
    return (
      <div className="space-y-5">
        <button
          type="button"
          onClick={() => { setStep('form'); setError(''); }}
          className="inline-flex h-11 items-center gap-1 text-sm font-semibold text-black"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
          ย้อนกลับ
        </button>

        <section aria-label="ยืนยัน PIN" className="flex flex-col items-center gap-3 rounded-3xl border border-line bg-white p-6">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-black text-[#FFC400]">
            <LockKeyhole className="h-6 w-6" aria-hidden />
          </span>
          <h1 className="text-lg font-bold text-black">ยืนยันด้วย PIN</h1>
          <p className="text-xs text-neutral-400">
            กรอก PIN 6 หลักเพื่อยืนยันการเติมเงิน {baht(parsedAmount)}
          </p>
          <input
            type="password"
            inputMode="numeric"
            autoComplete="off"
            maxLength={6}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
            placeholder="••••••"
            aria-label="PIN 6 หลัก"
            data-testid="topup-pin-input"
            className="h-14 w-40 text-center text-2xl font-bold tabular-nums tracking-[0.5em] outline-none rounded-2xl border border-line bg-neutral-50 focus:border-[#FFC400]"
          />
          {error && (
            <p role="alert" className="w-full rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
            </p>
          )}
          <button
            type="button"
            onClick={() => void verifyPinAndCreate()}
            disabled={verifying || pin.length !== 6}
            data-testid="topup-continue"
            className="btn-brand h-12 w-full text-sm"
          >
            {verifying ? 'กำลังตรวจสอบ…' : 'ยืนยันและสร้างคิวอาร์โค้ด'}
          </button>
        </section>
      </div>
    );
  }

  // ขั้นที่ 1: ฟอร์มเลือกยอด
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
          min={1}
          max={50000}
          step={1}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0"
          data-testid="topup-amount-input"
          className="h-14 w-full rounded-2xl border border-line bg-neutral-50 px-4 text-lg font-bold tabular-nums outline-none focus:border-[#FFC400]"
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
        onClick={continueToPin}
        disabled={submitting || !amount}
        data-testid="topup-continue"
        className="btn-brand h-12 w-full text-sm"
      >
        ดำเนินการต่อ
      </button>

      <p className="flex items-start gap-1.5 text-xs text-neutral-400">
        <Landmark className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
        ชำระด้วยพร้อมเพย์ QR แล้วแนบสลิป — ผู้ดูแลตรวจสลิปและอนุมัติยอดเข้ากระเป๋า
      </p>
    </div>
  );
}
