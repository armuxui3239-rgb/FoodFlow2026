'use client';

import Link from 'next/link';
import { Component, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  ArrowLeft,
  CircleHelp,
  Facebook,
  Globe,
  Headset,
  Info,
  Instagram,
  MessageCircle,
  Phone,
  Twitter,
} from 'lucide-react';

interface Faq {
  q: string;
  a: string;
}

/** คำถามที่พบบ่อย — เนื้อหาจริงทั้งหมด (ห้าม lorem) */
const FAQS: Faq[] = [
  {
    q: 'วิธีสั่งอาหารทำอย่างไร?',
    a: 'เลือกร้านอาหารที่ต้องการ แตะเมนูที่สนใจเพื่อใส่ตะกร้า เมื่อพร้อมแล้วกดไปที่ตะกร้าและกด "ดำเนินการชำระเงิน" เลือกที่อยู่จัดส่ง ตรวจสอบราคารวมค่าจัดส่ง แล้วยืนยันคำสั่งซื้อ เท่านี้อาหารก็กำลังเตรียมส่งถึงคุณ',
  },
  {
    q: 'วิธีชำระเงินผ่านพร้อมเพย์ (PromptPay) ทำอย่างไร?',
    a: 'หลังยืนยันคำสั่งซื้อ ระบบจะสร้าง QR พร้อมเพย์ขึ้นมาให้ทันที ให้เปิดแอปธนาคารของคุณแล้วสแกน QR จำนวนเงินจะตรงกับยอดรวมของคำสั่งซื้อ (รวมค่าจัดส่งแล้ว) เมื่อชำระแล้วกดปุ่มยืนยันการชำระเงินในแอป ระบบจะส่งออเดอร์เข้าร้านให้อัตโนมัติ',
  },
  {
    q: 'ตรวจสถานะคำสั่งซื้อได้จากที่ไหน?',
    a: 'ไปที่เมนู "คำสั่งซื้อ" ด้านล่างจอ แล้วแตะรายการที่ต้องการ จะเห็นสถานะล่าสุดตั้งแต่ "รอร้านตอบรับ" "กำลังเตรียมอาหาร" ไปจนถึง "กำลังจัดส่ง" และ "ส่งถึงแล้ว"',
  },
  {
    q: 'ยกเลิกคำสั่งซื้อได้เมื่อไร?',
    a: 'ยกเลิกได้เฉพาะก่อนร้านตอบรับออเดอร์ คือตอนสถานะยังเป็น "กำลังสร้าง" "รอชำระเงิน" หรือ "รอร้านตอบรับ" โดยไปที่หน้าคำสั่งซื้อ หมวด "กำลังดำเนินการ" แล้วกดปุ่มยกเลิกที่รายการนั้น หลังร้านรับออเดอร์แล้วจะยกเลิกเองไม่ได้ กรุณาติดต่อฝ่ายบริการลูกค้า',
  },
  {
    q: 'เปลี่ยนที่อยู่จัดส่งได้อย่างไร?',
    a: 'เปลี่ยนได้ที่หน้าชำระเงินก่อนกดยืนยันคำสั่งซื้อ หรือจะเพิ่ม/แก้ไขที่อยู่ล่วงหน้าได้ที่ "โปรไฟล์ > ที่อยู่ของฉัน" หลังยืนยันคำสั่งซื้อแล้วจะแก้ที่อยู่ไม่ได้เพื่อความถูกต้องในการจัดส่ง',
  },
  {
    q: 'เติมเงินเข้ากระเป๋าเงินทำอย่างไร?',
    a: 'ไปที่ "โปรไฟล์ > กระเป๋าเงิน" กดเติมเงินแล้วเลือกยอดที่ต้องการ ชำระผ่าน QR พร้อมเพย์ได้ทันที ยอดเงินจะเข้ากระเป๋าในไม่กี่วินาที และใช้หักค่าอาหารได้ทุกคำสั่งซื้อ',
  },
  {
    q: 'ค่าจัดส่งเท่าไร?',
    a: 'ค่าจัดส่งคิดเหมาะ ฿35 ต่อคำสั่งซื้อ คิดเพียงครั้งเดียวต่อออเดอร์ ไม่ว่าจะสั่งกี่เมนู และจะแสดงยอดรวมทั้งหมดให้เห็นก่อนกดยืนยันทุกครั้ง',
  },
  {
    q: 'ลืม PIN ทำอย่างไร?',
    a: 'ที่หน้าเข้าสู่ระบบกด "ลืม PIN" ระบบจะส่งรหัส OTP ไปที่เบอร์โทรที่ผูกไว้ ยืนยันตัวตนสำเร็จแล้วคุณจะตั้ง PIN ใหม่ได้ทันที',
  },
  {
    q: 'เปลี่ยนเบอร์โทรศัพท์ได้ไหม?',
    a: 'เบอร์โทรศัพท์ผูกกับการยืนยันตัวตนผ่าน OTP จึงเปลี่ยนเองในแอปไม่ได้ กรุณาติดต่อฝ่ายบริการลูกค้าเพื่อขอเปลี่ยนเบอร์ โดยทีมงานจะยืนยันตัวตนของคุณอีกครั้งเพื่อความปลอดภัย',
  },
  {
    q: 'ให้คะแนนและรีวิวร้านได้อย่างไร?',
    a: 'หลังคำสั่งซื้อมีสถานะ "ส่งถึงแล้ว" จะมีปุ่มให้คะแนนในหน้ารายละเอียดคำสั่งซื้อ เลือกดาว 1-5 ดาวและพิมพ์รีวิวได้เลย คะแนนของคุณช่วยให้คนอื่นเลือกร้านได้ง่ายขึ้น',
  },
  {
    q: 'ใช้คูปองอย่างไร?',
    a: 'ที่หน้าชำระเงินก่อนยืนยันคำสั่งซื้อ กดเลือกคูปองที่มี ส่วนลดจะถูกหักออกจากยอดรวมทันที โปรดตรวจสอบเงื่อนไขขั้นต่ำและวันหมดอายุในรายละเอียดของคูปองแต่ละใบ',
  },
  {
    q: 'เชิญเพื่อนรับส่วนลดทำอย่างไร?',
    a: 'ไปที่ "โปรไฟล์ > เชิญเพื่อนรับส่วนลด" แล้วคัดลอกโค้ดเชิญของคุณส่งให้เพื่อน เมื่อเพื่อนสมัครและสั่งซื้อสำเร็จเป็นครั้งแรก คุณจะได้รับส่วนลดสำหรับคำสั่งซื้อถัดไป',
  },
  {
    q: 'ระบบโทรหาไรเดอร์เมื่อไรจะพร้อม?',
    a: 'ยังไม่เปิดใช้งาน — จะพร้อมเมื่อมีเซิร์ฟเวอร์รองรับ ขณะนี้หากมีปัญหาในการจัดส่ง กรุณาแชทกับฝ่ายบริการลูกค้าแล้วทีมงานจะช่วยประสานงานกับไรเดอร์ให้',
  },
  {
    q: 'แผนที่ติดตามไรเดอร์เปิดใช้ได้หรือยัง?',
    a: 'อยู่ระหว่างพัฒนา ขณะนี้สามารถดูสถานะล่าสุดของคำสั่งซื้อได้จากหน้ารายละเอียดคำสั่งซื้อ แล้วพบกับแผนที่เรียลไทม์เร็ว ๆ นี้',
  },
  {
    q: 'ข้อมูลส่วนตัวของฉันปลอดภัยแค่ไหน?',
    a: 'เราเก็บข้อมูลเฉพาะส่วนที่จำเป็นต่อการจัดส่งอาหาร เช่น ชื่อ เบอร์โทร และที่อยู่ ไม่มีการขายข้อมูลให้บุคคลที่สาม และคุณขอดู แก้ไข หรือลบข้อมูลของตนเองได้ตลอดเวลาผ่านฝ่ายบริการลูกค้า',
  },
];

/** ช่องทางติดต่ออื่น — ยังไม่เปิดใช้งาน (ห้ามลิงก์จริงออกภายนอก) */
const OTHER_CHANNELS: { label: string; detail: string; Icon: typeof Phone }[] = [
  { label: 'Facebook', detail: 'เพจฟู๊ด ธันเดอร์', Icon: Facebook },
  { label: 'LINE', detail: 'LINE Official Account', Icon: MessageCircle },
  { label: 'เว็บไซต์', detail: 'foodthunder.co.th', Icon: Globe },
  { label: 'X', detail: '@FoodThunderTH', Icon: Twitter },
  { label: 'Instagram', detail: '@foodthunder.th', Icon: Instagram },
  { label: 'โทรศัพท์', detail: 'สายด่วนบริการลูกค้า', Icon: Phone },
];

/** Error boundary เล็ก ๆ สำหรับสถานะ error ของหน้านี้ */
class HelpErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-red-50">
            <CircleHelp className="h-8 w-8 text-red-400" aria-hidden />
          </span>
          <p className="text-sm text-red-500">เกิดข้อผิดพลาดในการแสดงศูนย์ช่วยเหลือ</p>
          <button
            type="button"
            onClick={() => this.setState({ hasError: false })}
            className="btn-brand h-11 rounded-full px-6 text-sm"
          >
            ลองอีกครั้ง
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

type HelpTab = 'faq' | 'contact';

function HelpCenterContent() {
  const [mounted, setMounted] = useState(false);
  const [tab, setTab] = useState<HelpTab>('faq');
  const [openItem, setOpenItem] = useState<string | null>(null);

  useEffect(() => {
    // ตั้งค่าผ่าน callback ของ timer (ไม่ใช่ setState พร้อมกันใน effect)
    const timer = setTimeout(() => setMounted(true), 0);
    return () => clearTimeout(timer);
  }, []);

  if (!mounted) {
    // สถานะ loading — รอการไฮเดรตก่อนแสดงเนื้อหา
    return (
      <div className="space-y-4" aria-busy="true" aria-label="กำลังโหลดศูนย์ช่วยเหลือ">
        <div className="h-11 animate-pulse rounded-full bg-neutral-100" />
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-14 animate-pulse rounded-2xl bg-neutral-100" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <header className="flex items-center gap-3 pt-1">
        <Link
          href="/profile"
          aria-label="ย้อนกลับไปหน้าโปรไฟล์"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-line bg-white transition-colors hover:bg-[#FFF4CC]"
        >
          <ArrowLeft className="h-4 w-4 text-black" aria-hidden />
        </Link>
        <h1 className="text-lg font-bold text-black">ศูนย์ช่วยเหลือ</h1>
      </header>

      {/* แถบแท็บ — คำถามที่พบบ่อย / ติดต่อเรา */}
      <div role="tablist" aria-label="หมวดศูนย์ช่วยเหลือ" className="flex rounded-full bg-neutral-100 p-1">
        {(
          [
            { key: 'faq', label: 'คำถามที่พบบ่อย' },
            { key: 'contact', label: 'ติดต่อเรา' },
          ] as { key: HelpTab; label: string }[]
        ).map(({ key, label }) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            data-testid={`help-tab-${key}`}
            onClick={() => setTab(key)}
            className={`flex h-11 flex-1 items-center justify-center gap-1.5 rounded-full text-sm font-semibold transition-colors ${
              tab === key ? 'bg-black text-[#FFC400]' : 'text-neutral-500 hover:text-black'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'faq' && (
        <div role="tabpanel" aria-label="คำถามที่พบบ่อย">
          {FAQS.length === 0 ? (
            // สถานะ empty — กันกรณีไม่มีคำถามในระบบ
            <div className="flex flex-col items-center gap-3 rounded-3xl border border-line bg-white py-14 text-center">
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-neutral-100">
                <CircleHelp className="h-8 w-8 text-neutral-300" aria-hidden />
              </span>
              <p className="text-sm text-neutral-400">ยังไม่มีคำถามที่พบบ่อย</p>
            </div>
          ) : (
            // Accordion จาก shadcn/ui — เปิดได้ทีละข้อ
            <Accordion
              type="single"
              collapsible
              value={openItem ?? ''}
              onValueChange={(v) => setOpenItem(v || null)}
              className="overflow-hidden rounded-3xl border border-line bg-white px-4"
            >
              {FAQS.map((f, i) => (
                <AccordionItem key={`faq-${i}`} value={`faq-${i}`} className="border-line last:border-b-0">
                  <AccordionTrigger
                    data-testid={`faq-item-${i}`}
                    className="gap-3 rounded-none py-4 text-sm font-medium text-black hover:no-underline [&>svg]:text-neutral-400"
                  >
                    {f.q}
                  </AccordionTrigger>
                  <AccordionContent className="text-sm leading-relaxed text-neutral-700">
                    {f.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </div>
      )}

      {tab === 'contact' && (
        <div role="tabpanel" aria-label="ติดต่อเรา" className="space-y-4">
          {/* ปุ่มใหญ่แชทฝ่ายบริการลูกค้า */}
          <Link
            href="/messages"
            data-testid="contact-chat"
            className="btn-brand flex h-14 w-full items-center justify-center gap-2 text-sm"
          >
            <Headset className="h-5 w-5" aria-hidden />
            แชทกับฝ่ายบริการลูกค้า
          </Link>

          <div className="overflow-hidden rounded-3xl border border-line bg-white">
            {OTHER_CHANNELS.map(({ label, detail, Icon }, i) => (
              <div
                key={label}
                className={`flex items-center gap-3 px-4 py-4 ${i > 0 ? 'border-t border-line' : ''}`}
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-neutral-100">
                  <Icon className="h-4 w-4 text-neutral-400" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-neutral-400">{label}</span>
                  <span className="block truncate-1 text-xs text-neutral-300">{detail}</span>
                </span>
                <span className="shrink-0 rounded-full bg-neutral-100 px-2.5 py-1 text-[10px] font-bold text-neutral-400">
                  ยังไม่เปิดใช้งาน
                </span>
              </div>
            ))}
          </div>

          <div className="flex items-start gap-2 rounded-2xl bg-[#FFF4CC] px-4 py-3">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-black" aria-hidden />
            <p className="text-xs leading-relaxed text-neutral-700">
              ช่องทางติดต่ออื่น ๆ กำลังอยู่ระหว่างการเปิดใช้งาน ขณะนี้แชทผ่านแอปเป็นช่องทางหลักที่ตอบเร็วที่สุด
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function HelpPage() {
  return (
    <HelpErrorBoundary>
      <HelpCenterContent />
    </HelpErrorBoundary>
  );
}
