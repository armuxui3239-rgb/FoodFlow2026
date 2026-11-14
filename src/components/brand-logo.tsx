import Image from 'next/image';

import { cn } from '@/lib/utils';

/** โลโก้แบรนด์จริง — ไฟล์เดียวที่ public/brand/logo.png เปลี่ยนที่เดียวทั้งระบบ (v4 ข้อ 2) */
export function BrandLogo({ className }: { className?: string }) {
  return (
    <Image
      src="/brand/logo.png"
      alt=""
      width={500}
      height={500}
      priority
      className={cn('h-9 w-9 shrink-0 rounded-xl object-cover', className)}
    />
  );
}
