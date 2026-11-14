'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Fingerprint,
  KeyRound,
  LogIn,
  ScanFace,
  ShieldCheck,
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { api } from '@/lib/client';

const REMEMBER_KEY = 'ft_remember';
const PIN_FIELD = 'h-12 w-full rounded-2xl border border-line bg-neutral-50 px-4 text-center text-lg font-bold tracking-[0.4em] outline-none focus:border-[#FFC400]';

/** หน้าความปลอดภัย — จดจำการเข้าสู่ระบบ (localStorage) + เปลี่ยน PIN + ลบบัญชี (PDPA) */
export default function SecuritySettingsPage() {
  const router = useRouter();
  const [remember, setRemember] = useState(true);
  const [ready, setReady] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [pinOpen, setPinOpen] = useState(false);
  const [oldPin, setOldPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [changing, setChanging] = useState(false);
  const [pinErr, setPinErr] = useState('');
  const [pinMsg, setPinMsg] = useState('');

  const submitPin = async () => {
    if (newPin !== confirmPin) {
      setPinErr('PIN ยืนยันไม่ตรงกัน');
      return;
    }
    setChanging(true);
    setPinErr('');
    setPinMsg('');
    try {
      await api('/api/auth/change-pin', {
        method: 'POST',
        body: JSON.stringify({ oldPin, newPin }),
      });
      setPinMsg('เปลี่ยน PIN สำเร็จ');
      setOldPin('');
      setNewPin('');
      setConfirmPin('');
    } catch (e) {
      setPinErr(e instanceof Error ? e.message : 'เปลี่ยน PIN ไม่สำเร็จ');
    } finally {
      setChanging(false);
    }
  };

  // ลบบัญชี (PDPA) — ยืนยัน 2 ชั้นแล้วปิดบัญชี + ลบข้อมูลส่วนบุคคล
  const deleteAccount = async () => {
    if (!window.confirm('ยืนยันลบบัญชี? ข้อมูลส่วนบุคคลจะถูกลบทันทีและย้อนคืนไม่ได้')) return;
    if (!window.confirm('ยืนยันอีกครั้ง — การลบบัญชีไม่สามารถย้อนคืนได้จริง ๆ หรือไม่?')) return;
    setDeleting(true);
    try {
      await api('/api/auth/delete-account', { method: 'POST' });
      router.replace('/login');
    } catch {
      setDeleting(false);
    }
  };

  // อ่านค่าจดจำการเข้าสู่ระบบจาก localStorage (ต้องรอฝั่ง client ก่อน กัน hydration ไม่ตรง)
  useEffect(() => {
    try {
      setRemember(window.localStorage.getItem(REMEMBER_KEY) !== 'false');
    } catch {
      setRemember(true);
    } finally {
      setReady(true);
    }
  }, []);

  const toggleRemember = (next: boolean) => {
    setRemember(next);
    try {
      window.localStorage.setItem(REMEMBER_KEY, String(next));
    } catch {
      // ไม่มี localStorage (โหมดส่วนตัว) — เก็บไว้ในหน้าจออย่างเดียว
    }
  };

  return (
    <div className="space-y-4">
      {/* หัวเรื่อง — ย้อนกลับไปหน้าโปรไฟล์ */}
      <div className="relative flex items-center justify-center py-1">
        <Link
          href="/profile"
          aria-label="ย้อนกลับ"
          className="absolute left-0 flex h-10 w-10 items-center justify-center rounded-full border border-line bg-white hover:bg-neutral-50"
        >
          <ChevronLeft className="h-5 w-5" aria-hidden />
        </Link>
        <h1 className="text-lg font-bold text-black">ความปลอดภัย</h1>
      </div>

      {/* รายการตั้งค่าความปลอดภัย */}
      <div className="overflow-hidden rounded-3xl border border-line bg-white">
        {/* จดจำการเข้าสู่ระบบ — เปิด/ปิดได้ เก็บใน localStorage */}
        <div className="flex items-center gap-3 px-4 py-4">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#FFF4CC]">
            <LogIn className="h-4.5 w-4.5 text-black" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-black">จดจำการเข้าสู่ระบบ</p>
            <p className="text-[11px] text-neutral-400">หยุดพักแล้วกลับมาโดยไม่ต้องเข้าสู่ระบบใหม่</p>
          </div>
          <Switch
            checked={ready ? remember : false}
            onCheckedChange={toggleRemember}
            aria-label="จดจำการเข้าสู่ระบบ"
            className="data-[state=checked]:bg-black data-[state=unchecked]:bg-neutral-200"
          />
        </div>

        {/* Face ID — ยังไม่เปิดใช้งาน */}
        <div className="flex items-center gap-3 border-t border-line px-4 py-4 opacity-70">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-neutral-100">
            <ScanFace className="h-4.5 w-4.5 text-neutral-400" aria-hidden />
          </span>
          <p className="flex-1 text-sm font-medium text-neutral-400">Face ID</p>
          <span className="shrink-0 rounded-full bg-[#FFF4CC] px-2 py-0.5 text-[10px] font-bold text-black">
            ยังไม่เปิดใช้งาน
          </span>
          <Switch disabled aria-label="Face ID (ยังไม่เปิดใช้งาน)" className="data-[state=unchecked]:bg-neutral-200" />
        </div>

        {/* ลายนิ้วมือ — ยังไม่เปิดใช้งาน */}
        <div className="flex items-center gap-3 border-t border-line px-4 py-4 opacity-70">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-neutral-100">
            <Fingerprint className="h-4.5 w-4.5 text-neutral-400" aria-hidden />
          </span>
          <p className="flex-1 text-sm font-medium text-neutral-400">ยืนยันด้วยลายนิ้วมือ</p>
          <span className="shrink-0 rounded-full bg-[#FFF4CC] px-2 py-0.5 text-[10px] font-bold text-black">
            ยังไม่เปิดใช้งาน
          </span>
          <Switch disabled aria-label="ยืนยันด้วยลายนิ้วมือ (ยังไม่เปิดใช้งาน)" className="data-[state=unchecked]:bg-neutral-200" />
        </div>

        {/* Google Authenticator — ยังไม่เปิดใช้งาน */}
        <div
          aria-disabled="true"
          className="flex cursor-not-allowed items-center gap-3 border-t border-line px-4 py-4 opacity-70"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-neutral-100">
            <ShieldCheck className="h-4.5 w-4.5 text-neutral-400" aria-hidden />
          </span>
          <p className="flex-1 text-sm font-medium text-neutral-400">Google Authenticator</p>
          <span className="shrink-0 rounded-full bg-[#FFF4CC] px-2 py-0.5 text-[10px] font-bold text-black">
            ยังไม่เปิดใช้งาน
          </span>
          <ChevronRight className="h-4 w-4 shrink-0 text-neutral-300" aria-hidden />
        </div>
      </div>

      {/* เปลี่ยน PIN — ต้องยืนยัน PIN เดิมก่อน (v4 ข้อ 4.5 / หน้าจอ 81) */}
      <section aria-label="เปลี่ยน PIN" className="space-y-3 rounded-3xl border border-line bg-white p-4">
        <p className="text-sm font-bold text-black">เปลี่ยน PIN</p>
        {pinOpen ? (
          <>
            <input
              type="password"
              inputMode="numeric"
              autoComplete="off"
              maxLength={6}
              value={oldPin}
              onChange={(e) => setOldPin(e.target.value.replace(/\D/g, ''))}
              placeholder="PIN เดิม"
              aria-label="PIN เดิม"
              className={PIN_FIELD}
            />
            <input
              type="password"
              inputMode="numeric"
              autoComplete="off"
              maxLength={6}
              value={newPin}
              onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
              placeholder="PIN ใหม่ 6 หลัก"
              aria-label="PIN ใหม่"
              className={PIN_FIELD}
            />
            <input
              type="password"
              inputMode="numeric"
              autoComplete="off"
              maxLength={6}
              value={confirmPin}
              onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
              placeholder="ยืนยัน PIN ใหม่"
              aria-label="ยืนยัน PIN ใหม่"
              className={PIN_FIELD}
            />
            {pinErr && (
              <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">
                {pinErr}
              </p>
            )}
            {pinMsg && (
              <p role="status" className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                {pinMsg}
              </p>
            )}
            <button
              type="button"
              onClick={() => void submitPin()}
              disabled={changing || oldPin.length !== 6 || newPin.length !== 6 || confirmPin.length !== 6}
              className="btn-brand h-12 w-full text-sm"
            >
              {changing ? 'กำลังเปลี่ยน…' : 'ยืนยันเปลี่ยน PIN'}
            </button>
            <button
              type="button"
              onClick={() => {
                setPinOpen(false);
                setPinErr('');
                setPinMsg('');
              }}
              className="h-9 w-full text-xs text-neutral-400 underline"
            >
              ยกเลิก
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setPinOpen(true)}
              className="btn-brand flex h-12 w-full items-center justify-center gap-2 text-sm"
            >
              <KeyRound className="h-4 w-4" aria-hidden />
              เปลี่ยน PIN
            </button>
            <Link href="/forgot-pin" className="block text-center text-xs text-neutral-400 underline">
              ลืม PIN? — ขอรีเซ็ตผ่านรหัสยืนยัน
            </Link>
          </>
        )}
        <p className="px-2 text-center text-[11px] leading-relaxed text-neutral-400">
          PIN ใช้สำหรับยืนยันการชำระเงินและเข้าสู่ระบบอย่างรวดเร็ว — อย่าบอก PIN ให้ผู้อื่น
        </p>
      </section>

      {/* ลบบัญชี — สิทธิ์ลบข้อมูลส่วนบุคคลตาม PDPA (v4 ข้อ 11) */}
      <section aria-label="ลบบัญชี" className="space-y-2 rounded-3xl border border-red-200 bg-white p-4">
        <p className="text-sm font-bold text-red-600">ลบบัญชี</p>
        <p className="text-xs leading-relaxed text-neutral-400">
          ปิดบัญชีและลบข้อมูลส่วนบุคคลทันที (ชื่อ/อีเมล/เบอร์/ที่อยู่/ร้านโปรด/PIN) —
          บันทึกธุรกรรมเก็บแบบไม่ระบุตัวตนตามภาระกฎหมาย ย้อนคืนไม่ได้ อ่านรายละเอียดในนโยบายความเป็นส่วนตัว
        </p>
        <button
          type="button"
          onClick={() => void deleteAccount()}
          disabled={deleting}
          data-testid="delete-account"
          className="h-11 w-full rounded-full border border-red-200 bg-white text-sm font-bold text-red-600 hover:bg-red-50 disabled:opacity-50"
        >
          {deleting ? 'กำลังลบบัญชี…' : 'ลบบัญชีของฉัน'}
        </button>
      </section>

      {/* สถานะว่างเชิงตรรกะ: ไม่มีข้อมูลที่ต้องโหลดจากเซิร์ฟเวอร์ จึงไม่มีสถานะ error — แสดงคำแนะนำความปลอดภัยแทน */}
      <div className="flex items-start gap-2 rounded-3xl bg-[#FFF4CC] p-4 text-xs leading-relaxed text-black">
        <CircleHelp className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <p>
          เพื่อความปลอดภัย กรุณาตั้ง PIN ที่จำง่ายแต่ไม่เดายาก เช่น หลีกเลี่ยงวันเกิดหรือเลขซ้ำ
          และเปลี่ยน PIN เมื่อสงสัยว่ามีผู้อื่นรู้รหัสของคุณ
        </p>
      </div>
    </div>
  );
}
