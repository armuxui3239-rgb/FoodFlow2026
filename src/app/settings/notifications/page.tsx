'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import {
  Bell,
  ChevronLeft,
  CircleHelp,
  Package,
  Percent,
  Sparkles,
  Vibrate,
  Volume2,
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { api } from '@/lib/client';

interface NotificationSetting {
  id: string;
  event_type: string;
  enabled: boolean;
}

/** ลำดับการแสดงผล + ชื่อภาษาไทย + ไอคอนของแต่ละประเภทการแจ้งเตือน */
const DISPLAY: { key: string; title: string; Icon: typeof Bell }[] = [
  { key: 'order_updates', title: 'อัปเดตคำสั่งซื้อ', Icon: Package },
  { key: 'promotions', title: 'โปรโมชั่นและข้อเสนอ', Icon: Percent },
  { key: 'new_services', title: 'บริการใหม่', Icon: Sparkles },
];

export default function NotificationSettingsPage() {
  const [settings, setSettings] = useState<NotificationSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    api<{ data: NotificationSetting[] }>('/api/settings/notifications')
      .then((r) => setSettings(r.data))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);
  useEffect(load, [load]);

  /** เปิด/ปิดแล้ว PATCH ทันที (อัปเดตหน้าจอทันที ถ้าพลาดคืนค่าเดิม) */
  const toggle = async (eventType: string, next: boolean) => {
    const prev = settings;
    setSavingKey(eventType);
    setSettings((s) => s.map((x) => (x.event_type === eventType ? { ...x, enabled: next } : x)));
    try {
      await api('/api/settings/notifications', {
        method: 'PATCH',
        body: JSON.stringify({ eventType, enabled: next }),
      });
    } catch (e) {
      setSettings(prev);
      setError((e as Error).message);
    } finally {
      setSavingKey(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="กำลังโหลดการตั้งค่าการแจ้งเตือน">
        <div className="relative flex items-center justify-center py-1">
          <div className="h-10 w-10 animate-pulse rounded-full bg-neutral-100" />
        </div>
        <div className="overflow-hidden rounded-3xl border border-line bg-white">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 border-b border-line px-4 py-4 last:border-b-0">
              <div className="h-9 w-9 shrink-0 animate-pulse rounded-xl bg-neutral-100" />
              <div className="h-4 flex-1 animate-pulse rounded bg-neutral-100" />
              <div className="h-5 w-9 shrink-0 animate-pulse rounded-full bg-neutral-100" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error && settings.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-red-50">
          <CircleHelp className="h-8 w-8 text-red-400" aria-hidden />
        </span>
        <p className="text-sm text-red-500">{error}</p>
        <button onClick={load} className="btn-brand h-11 rounded-full px-6 text-sm">
          ลองอีกครั้ง
        </button>
      </div>
    );
  }

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
        <h1 className="text-lg font-bold text-black">การแจ้งเตือน</h1>
      </div>

      {error && settings.length > 0 && (
        <p className="rounded-2xl bg-red-50 px-4 py-2 text-xs text-red-500" role="alert">
          {error}
        </p>
      )}

      {/* กลุ่ม: การแจ้งเตือนทั่วไป */}
      <section aria-label="การแจ้งเตือนทั่วไป">
        <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-neutral-400">
          การแจ้งเตือนทั่วไป
        </h2>
        <div className="overflow-hidden rounded-3xl border border-line bg-white">
          {DISPLAY.map(({ key, title, Icon }, i) => {
            const row = settings.find((s) => s.event_type === key);
            return (
              <div
                key={key}
                className={`flex items-center gap-3 px-4 py-4 ${i > 0 ? 'border-t border-line' : ''}`}
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#FFF4CC]">
                  <Icon className="h-4.5 w-4.5 text-black" aria-hidden />
                </span>
                <span className="flex-1 text-sm font-medium text-black">{title}</span>
                <Switch
                  checked={row?.enabled ?? true}
                  disabled={savingKey === key}
                  onCheckedChange={(v) => void toggle(key, v)}
                  aria-label={title}
                  className="data-[state=checked]:bg-black data-[state=unchecked]:bg-neutral-200"
                />
              </div>
            );
          })}
        </div>
      </section>

      {/* กลุ่มเพิ่มเติม — ยังไม่เปิดใช้งาน */}
      <section aria-label="การแจ้งเตือนแบบอื่น">
        <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-neutral-400">
          การแจ้งเตือนแบบอื่น
        </h2>
        <div className="overflow-hidden rounded-3xl border border-line bg-white">
          {[
            { title: 'เสียง', Icon: Volume2 },
            { title: 'การสั่น', Icon: Vibrate },
          ].map(({ title, Icon }, i) => (
            <div
              key={title}
              className={`flex items-center gap-3 px-4 py-4 opacity-70 ${i > 0 ? 'border-t border-line' : ''}`}
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-neutral-100">
                <Icon className="h-4.5 w-4.5 text-neutral-400" aria-hidden />
              </span>
              <span className="flex-1 text-sm font-medium text-neutral-400">{title}</span>
              <span className="shrink-0 rounded-full bg-[#FFF4CC] px-2 py-0.5 text-[10px] font-bold text-black">
                ยังไม่เปิดใช้งาน
              </span>
              <Switch disabled aria-label={`${title} (ยังไม่เปิดใช้งาน)`} className="data-[state=unchecked]:bg-neutral-200" />
            </div>
          ))}
        </div>
      </section>

      <p className="flex items-start gap-2 px-1 text-[11px] leading-relaxed text-neutral-400">
        <Bell className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
        การแจ้งเตือนจะส่งผ่านช่องทางพุช (Push) บนอุปกรณ์ของคุณ คุณสามารถเปลี่ยนแปลงได้ทุกเมื่อ
      </p>
    </div>
  );
}
