'use client';

import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

const THEME_KEY = 'ft_theme';

/** ปุ่มสลับโหมดมืด/สว่าง — .dark บน <html> + จำค่าใน localStorage 'ft_theme'
 *  (การตั้งค่าแรกเข้าทำโดย script กันวาบใน layout.tsx: ค่าที่บันทึกไว้ > ค่าระบบปฏิบัติการ > สว่าง) */
export function ThemeToggle() {
  const [dark, setDark] = useState<boolean | null>(null);

  useEffect(() => {
    setDark(document.documentElement.classList.contains('dark'));
  }, []);

  const toggle = () => {
    const next = !(dark ?? false);
    document.documentElement.classList.toggle('dark', next);
    try {
      localStorage.setItem(THEME_KEY, next ? 'dark' : 'light');
    } catch {
      /* localStorage ใช้ไม่ได้ (โหมดส่วนตัว) — สลับได้จนกว่าปิดแท็บ */
    }
    setDark(next);
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? 'เปลี่ยนเป็นโหมดสว่าง' : 'เปลี่ยนเป็นโหมดมืด'}
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full hover:bg-neutral-100"
    >
      {dark === null ? (
        <span className="h-5 w-5" aria-hidden />
      ) : dark ? (
        <Sun className="h-5 w-5 text-[#FFC400]" aria-hidden />
      ) : (
        <Moon className="h-5 w-5 text-neutral-500" aria-hidden />
      )}
    </button>
  );
}
