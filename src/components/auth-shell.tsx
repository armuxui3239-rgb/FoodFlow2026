'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { BrandLogo } from '@/components/brand-logo';

interface AuthShellProps {
  /** หัวข้อ — เว้นได้สำหรับหน้าที่จัดองค์ประกอบเอง (เช่น welcome) */
  title?: string;
  subtitle?: string;
  backHref?: string;
  children: React.ReactNode;
  /** เนื้อหาแนวตั้งกึ่งกลางแบบเต็มจอ (สำหรับหน้า welcome) */
  centered?: boolean;
}

export function AuthShell({ title, subtitle, backHref, children, centered }: AuthShellProps) {
  const router = useRouter();
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <header className="flex items-center gap-3 px-4 pt-5 pb-2">
        {backHref && (
          <button
            type="button"
            aria-label="ย้อนกลับ"
            onClick={() => router.push(backHref)}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-line bg-white text-ink transition hover:bg-neutral-50 active:scale-95"
          >
            <ArrowLeft className="h-5 w-5" aria-hidden />
          </button>
        )}
        {title && <h1 className="text-lg font-bold text-ink">{title}</h1>}
      </header>
      <main
        className={`mx-auto flex w-full max-w-md flex-1 flex-col px-5 pb-10 ${
          centered ? 'items-center justify-center' : 'items-stretch justify-start pt-2'
        }`}
      >
        {subtitle && <p className="mb-5 text-center text-sm text-ink-soft">{subtitle}</p>}
        {children}
      </main>
      <div className="flex justify-center pb-4" aria-hidden>
        <BrandLogo />
      </div>
    </div>
  );
}
