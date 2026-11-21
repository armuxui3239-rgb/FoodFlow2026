'use client';

import { useRef } from 'react';
import { Monitor, Smartphone, X } from 'lucide-react';

/**
 * ปุ่มและหน้าต่าง <dialog> มาตรฐานสำหรับแสดงขั้นตอนติดตั้งแอป PWA ลงมือถือและพีซี
 */
export function PwaInstallGuideDialog() {
  const dialogRef = useRef<HTMLDialogElement | null>(null);

  return (
    <>
      <button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        className="flex w-full items-center gap-3 rounded-3xl border border-line bg-white px-4 py-4 text-left transition-colors hover:bg-neutral-50"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#FFF4CC]">
          <Smartphone className="h-4.5 w-4.5 text-black" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-black">วิธีติดตั้งแอปลงมือถือและพีซี</p>
          <p className="text-[11px] text-neutral-500">
            ดูขั้นตอนเพิ่มลงหน้าจอหลัก (Android, iOS และคอมพิวเตอร์) เพื่อรับเสียงแจ้งเตือนได้เสถียรขึ้น
          </p>
        </div>
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby="pwa-guide-title"
        className="m-auto w-[calc(100%-2rem)] max-w-md rounded-3xl border border-line bg-white p-0 text-black shadow-2xl backdrop:bg-black/50 backdrop:backdrop-blur-xs"
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 id="pwa-guide-title" className="text-base font-bold">
            ขั้นตอนติดตั้งแอป Food Thunder
          </h2>
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            aria-label="ปิดหน้าต่างขั้นตอนการติดตั้ง"
            className="flex h-8 w-8 items-center justify-center rounded-full text-neutral-500 hover:bg-neutral-100 hover:text-black"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4 text-xs leading-relaxed text-neutral-700">
          <section className="space-y-1.5 rounded-2xl bg-neutral-50 p-3.5">
            <h3 className="flex items-center gap-1.5 font-bold text-black">
              <Smartphone className="h-4 w-4" aria-hidden />
              Android (Chrome / Edge)
            </h3>
            <ol className="list-decimal space-y-1 pl-4">
              <li>เปิดเว็บแอปในเบราว์เซอร์ Chrome หรือ Edge</li>
              <li>แตะเมนูจุด 3 จุดมุมขวาบน แล้วเลือก &ldquo;ติดตั้งแอป&rdquo; หรือ &ldquo;เพิ่มลงในหน้าจอหลัก&rdquo;</li>
              <li>กดยืนยัน &ldquo;ติดตั้ง&rdquo; แอปจะปรากฏบนหน้าจอมือถือทันที</li>
            </ol>
          </section>

          <section className="space-y-1.5 rounded-2xl bg-neutral-50 p-3.5">
            <h3 className="flex items-center gap-1.5 font-bold text-black">
              <Smartphone className="h-4 w-4" aria-hidden />
              iPhone / iPad (Safari)
            </h3>
            <ol className="list-decimal space-y-1 pl-4">
              <li>เปิดเว็บแอปผ่านเบราว์เซอร์ Safari เท่านั้น</li>
              <li>แตะปุ่ม &ldquo;แชร์&rdquo; (ไอคอนสี่เหลี่ยมมีลูกศรชี้ขึ้น) ด้านล่างจอ</li>
              <li>เลื่อนลงแล้วเลือก &ldquo;เพิ่มไปยังหน้าจอโฮม&rdquo; (Add to Home Screen) จากนั้นกด &ldquo;เพิ่ม&rdquo;</li>
            </ol>
          </section>

          <section className="space-y-1.5 rounded-2xl bg-neutral-50 p-3.5">
            <h3 className="flex items-center gap-1.5 font-bold text-black">
              <Monitor className="h-4 w-4" aria-hidden />
              PC / คอมพิวเตอร์ (Chrome / Edge)
            </h3>
            <ol className="list-decimal space-y-1 pl-4">
              <li>เปิดเว็บแอปใน Chrome หรือ Edge บน Windows / macOS</li>
              <li>คลิกไอคอน &ldquo;ติดตั้ง&rdquo; (รูปจอคอมพิวเตอร์/บวก) ทางขวาของแถบ URL</li>
              <li>กด &ldquo;ติดตั้ง&rdquo; เพื่อเปิดใช้งานแบบหน้าต่างแอปแยกและปักหมุดที่ Taskbar/Dock ได้</li>
            </ol>
          </section>
        </div>

        <div className="border-t border-line px-5 py-3">
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            className="btn-brand h-10 w-full rounded-full text-sm font-bold"
          >
            เข้าใจแล้ว
          </button>
        </div>
      </dialog>
    </>
  );
}
