'use client';

import Link from 'next/link';
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

const REMEMBER_KEY = 'ft_remember';

/** หน้าความปลอดภัย — จดจำการเข้าสู่ระบบ (localStorage) + ตัวเลือกไบโอเมตริก/2FA ที่ยังไม่เปิดใช้งาน */
export default function SecuritySettingsPage() {
  const [remember, setRemember] = useState(true);
  const [ready, setReady] = useState(false);

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

      {/* เปลี่ยน PIN */}
      <section aria-label="เปลี่ยน PIN" className="space-y-2">
        <Link href="/forgot-pin" className="btn-brand flex h-12 w-full items-center justify-center gap-2 text-sm">
          <KeyRound className="h-4 w-4" aria-hidden />
          เปลี่ยน PIN
        </Link>
        <p className="px-2 text-center text-[11px] leading-relaxed text-neutral-400">
          PIN ใช้สำหรับยืนยันการชำระเงินและเข้าสู่ระบบอย่างรวดเร็ว — อย่าบอก PIN ให้ผู้อื่น
        </p>
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
