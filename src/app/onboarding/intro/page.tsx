'use client';

import { useCallback, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronRight, Zap } from 'lucide-react';

/**
 * หน้าแนะนำก่อนเข้าแอป (Intro Onboarding) — ภาพถ่ายจริงเต็มจอ
 * รูปแบบเดียวกับแอปสั่งอาหารระดับโลก (Grab / LINE MAN / foodpanda):
 * สไลด์แนวนอนเลื่อนได้ + จุดบอกตำแหน่ง + ข้ามได้ + ปุ่มหลักพาไปล็อกอิน
 */
const SLIDES = [
  {
    img: '/onboarding/food.jpg',
    alt: 'ภาพอาหารไทยหลากหลายจานวางบนโต๊ะไม้ ได้แก่ ผัดไทยกุ้ง แกงเขียวหวาน และข้าวเหนียวมะม่วง',
    title: 'อาหารไทยแท้ ครบจบในแอปเดียว',
    desc: 'ร้านอร่อยคัดสรรทั่วกรุงเทพฯ ตั้งแต่ข้าวมันไก่ริมทางถึงต้มยำกุ้งตำรับแม่',
  },
  {
    img: '/onboarding/rider.jpg',
    alt: 'ภาพไรเดอร์เสื้อเหลืองขับรถจักรยานยนต์ส่งอาหารกลางถนนยามค่ำในกรุงเทพฯ',
    title: 'จัดส่งไว อาหารถึงมือร้อน ๆ',
    desc: 'ไรเดอร์พร้อมส่งทุกวัน ติดตามสถานะได้ตลอดทางตั้งแต่ครัวจนถึงหน้าประตู',
  },
  {
    img: '/onboarding/pay.jpg',
    alt: 'ภาพมือถือโทรศัพท์สแกน QR พร้อมเพย์บนโต๊ะอาหาร',
    title: 'ชำระง่ายด้วยพร้อมเพย์',
    desc: 'สแกน QR จบในไม่กี่วินาที หรือเติมเงินเข้ากระเป๋าในแอปเพื่อชำระแบบไม่ต้องเสียเวลา',
  },
  {
    img: '/onboarding/deliver.jpg',
    alt: 'ภาพถุงส่งอาหารสีเหลืองวางหน้าบ้านพร้อมกล่องอาหารจัดส่ง',
    title: 'สั่งง่าย ครบทุกอย่าง จบในที่เดียว',
    desc: 'มีคูปองส่วนลด รีวิวจากผู้ใช้จริง และทีมช่วยเหลือพร้อมดูแลทุกคำสั่งซื้อ',
  },
];

const INTRO_COOKIE = 'ft_intro_seen=1; path=/; max-age=31536000; SameSite=Lax';

export default function IntroPage() {
  const router = useRouter();
  const trackRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const isLast = index === SLIDES.length - 1;

  const onScroll = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    setIndex(Math.round(el.scrollLeft / el.clientWidth));
  }, []);

  const scrollTo = useCallback((i: number) => {
    const el = trackRef.current;
    if (!el) return;
    el.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' });
  }, []);

  const finish = useCallback(() => {
    document.cookie = INTRO_COOKIE;
    router.replace('/login');
  }, [router]);

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-black">
      {/* แถบสไลด์ — เลื่อนแนวนอนแบบ snap เต็มจอ */}
      <div
        ref={trackRef}
        onScroll={onScroll}
        aria-label="สไลด์แนะนำการใช้งาน"
        className="no-scrollbar flex h-full w-full snap-x snap-mandatory overflow-x-auto scroll-smooth"
      >
        {SLIDES.map((s, i) => (
          <section
            key={s.img}
            aria-hidden={i !== index}
            className="relative h-full w-full shrink-0 snap-center"
          >
            {/* ภาพถ่ายจริงเต็มจอ */}
            <img
              src={s.img}
              alt={s.alt}
              className="absolute inset-0 h-full w-full object-cover"
              draggable={false}
              loading={i === 0 ? 'eager' : 'lazy'}
            />
            {/* เลเยอร์ไล่สีให้ตัวอักษรอ่านชัด (ดำแท้ตามแบรนด์) */}
            <div
              className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/35 to-black/10"
              aria-hidden
            />
            {/* ข้อความประกอบภาพ */}
            <div className="absolute inset-x-0 bottom-0 space-y-3 px-6 pb-40 text-white">
              <h1 className="text-2xl font-bold leading-snug drop-shadow-md">{s.title}</h1>
              <p className="max-w-md text-sm leading-relaxed text-white/85 drop-shadow-sm">
                {s.desc}
              </p>
            </div>
          </section>
        ))}
      </div>

      {/* โลโก้ + ปุ่มข้าม (ชั้นบน) */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between px-5 pt-5">
        <span
          className="pointer-events-auto flex h-10 items-center gap-1.5 rounded-full bg-black/55 px-3.5 backdrop-blur-sm"
          aria-label="ฟู๊ด ธันเดอร์"
        >
          <Zap className="h-4 w-4 fill-[#FFC400] text-[#FFC400]" aria-hidden />
          <span className="text-sm font-bold text-[#FFC400]">ฟู๊ด ธันเดอร์</span>
        </span>
        <button
          type="button"
          onClick={finish}
          className="pointer-events-auto rounded-full bg-black/55 px-4 py-2.5 text-sm font-semibold text-white backdrop-blur-sm transition active:scale-95 hover:bg-black/70"
        >
          ข้าม
        </button>
      </div>

      {/* แถบล่าง: จุดบอกตำแหน่ง + ปุ่มหลัก */}
      <div className="absolute inset-x-0 bottom-0 space-y-5 px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <div className="flex items-center justify-center gap-2" role="tablist" aria-label="ตำแหน่งสไลด์">
          {SLIDES.map((s, i) => (
            <button
              key={s.img}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={`สไลด์ ${i + 1} จาก ${SLIDES.length}`}
              onClick={() => scrollTo(i)}
              className={`h-2 rounded-full transition-all ${
                i === index ? 'w-6 bg-[#FFC400]' : 'w-2 bg-white/50 hover:bg-white/80'
              }`}
            />
          ))}
        </div>

        {isLast ? (
          <button
            type="button"
            onClick={finish}
            className="flex h-14 w-full items-center justify-center gap-1 rounded-full bg-[#FFC400] text-base font-bold text-black shadow-lg transition hover:bg-[#ffd34d] active:scale-[0.98]"
          >
            เริ่มต้นใช้งานฟู๊ด ธันเดอร์
            <ChevronRight className="h-5 w-5" aria-hidden />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => scrollTo(index + 1)}
            className="flex h-14 w-full items-center justify-center gap-1 rounded-full bg-[#FFC400] text-base font-bold text-black shadow-lg transition hover:bg-[#ffd34d] active:scale-[0.98]"
          >
            ถัดไป
            <ChevronRight className="h-5 w-5" aria-hidden />
          </button>
        )}
      </div>
    </div>
  );
}
