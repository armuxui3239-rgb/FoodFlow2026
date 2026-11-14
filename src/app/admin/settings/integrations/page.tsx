'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Bell,
  Bot,
  Map,
  MessageSquare,
  PhoneCall,
  QrCode,
  RefreshCw,
  Settings as SettingsIcon,
  ShieldCheck,
  Webhook,
} from 'lucide-react';
import { api, useSession } from '@/lib/client';
import { AdminFooter, AdminHeader } from '@/components/portal/admin-header';

interface SettingRow {
  key: string;
  value: unknown;
  updated_at: string | null;
  updatedByName: string | null;
}

type Status = 'ready' | 'not_connected' | 'server_side' | 'disabled';

const STATUS_LABEL: Record<Status, string> = {
  ready: 'พร้อมใช้งาน',
  not_connected: 'ยังไม่เชื่อมต่อ',
  server_side: 'ตั้งค่าฝั่งเซิร์ฟเวอร์ (.env)',
  disabled: 'ปิดใช้งาน',
};

const STATUS_BADGE: Record<Status, string> = {
  ready: 'bg-[#FFF4CC] text-black',
  not_connected: 'bg-neutral-100 text-neutral-500',
  server_side: 'bg-[#FFF4CC] text-neutral-700',
  disabled: 'bg-red-50 text-red-600',
};

/** flag ฝั่ง client (inline ตอน build เหมือน call-button.tsx) — ค่าอื่นใน .env อ่านจากเบราว์เซอร์ไม่ได้ */
const CALLS_ENABLED = process.env.NEXT_PUBLIC_CALLS_ENABLED === 'true';

interface IntegrationCard {
  Icon: typeof Map;
  title: string;
  staticStatus: Status;
  note: string;
  /** คีย์ integration_* ที่มีอยู่จริงใน platform_settings — ถ้าเป็นบูลีนจะใช้ทับสถานะคงที่ */
  flagKey?: string;
}

/** การ์ดสถานะตามความสามารถจริงของโค้ด (อ่านอย่างเดียว) — คีย์ integration_* ใน DB ใช้ทับสถานะได้ */
const CARDS: IntegrationCard[] = [
  {
    Icon: Map,
    title: 'แผนที่ OSM + MapLibre',
    staticStatus: 'ready',
    note: 'เส้นทาง /api/map/style ใช้งานได้จริง ไม่ต้องใช้ API key (keyless)',
  },
  {
    Icon: QrCode,
    title: 'ชำระเงิน PromptPay QR',
    staticStatus: 'ready',
    note: 'สร้าง payload QR ภายในระบบ — หมายเหตุ: ยืนยันการชำระเงินด้วยมืออยู่',
    flagKey: 'integration_promptpay_enabled',
  },
  {
    Icon: MessageSquare,
    title: 'SMS / OTP',
    staticStatus: 'server_side',
    note: 'ค่า VERIFICATION_DELIVERY อ่านได้เฉพาะฝั่งเซิร์ฟเวอร์ — dev_console: พิมพ์รหัส OTP ในคอนโซล / sms_gateway_selfhosted: ใช้เกตเวย์ SMS ที่โฮสต์เอง',
  },
  {
    Icon: PhoneCall,
    title: 'โทรผ่าน LiveKit',
    staticStatus: CALLS_ENABLED ? 'ready' : 'disabled',
    note: CALLS_ENABLED
      ? 'เปิดใช้งานแล้วผ่าน flag NEXT_PUBLIC_CALLS_ENABLED'
      : 'รอเซิร์ฟเวอร์ — เปิดด้วย flag NEXT_PUBLIC_CALLS_ENABLED=true เมื่อตั้งค่า LIVEKIT_* ใน .env แล้ว',
  },
  {
    Icon: Bot,
    title: 'ผู้ช่วย AI (แชทบอท)',
    staticStatus: 'not_connected',
    note: 'รอ provider key — ปัจจุบันตอบด้วยสคริปต์สำเร็จรูป',
    flagKey: 'integration_ai_chatbot_enabled',
  },
  {
    Icon: Webhook,
    title: 'Webhook ภายนอก',
    staticStatus: 'not_connected',
    note: 'ยังไม่มีปลายทางส่งเหตุการณ์ออกภายนอก',
    flagKey: 'integration_webhook_enabled',
  },
];

function valueToText(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

/** คืนบูลีนจากคีย์ใน DB (รองรับ true/"true") — ไม่มีคีย์หรือค่าไม่ใช่บูลีนคืน null */
function dbOverride(rows: SettingRow[], flagKey: string | undefined): boolean | null {
  if (!flagKey) return null;
  const row = rows.find((r) => r.key === flagKey);
  if (!row) return null;
  if (typeof row.value === 'boolean') return row.value;
  if (row.value === 'true') return true;
  if (row.value === 'false') return false;
  return null;
}

function fmtMeta(row: SettingRow): string {
  if (!row.updated_at) return 'ไม่ทราบเวลาอัปเดต';
  const time = new Date(row.updated_at).toLocaleString('th-TH', {
    day: '2-digit',
    month: 'short',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
  return row.updatedByName ? `อัปเดต ${time} โดย ${row.updatedByName}` : `อัปเดต ${time}`;
}

/** หน้าสถานะการเชื่อมต่อ (C5) — อ่านอย่างเดียว แสดงสถานะจริงจาก platform_settings (integration_*) + หมายเหตุความสามารถ */
export default function AdminIntegrationsPage() {
  const { user, ready, refresh } = useSession();
  const [rows, setRows] = useState<SettingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const load = useCallback(() => {
    setLoading(true);
    api<{ data: SettingRow[] }>('/api/admin/settings')
      .then((r) => {
        setRows(r.data.filter((row) => row.key.startsWith('integration_')));
        setError('');
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (!ready || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <p className="text-sm text-neutral-400">กำลังโหลด…</p>
      </div>
    );
  }
  if (user.role !== 'admin') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-white px-4 text-center">
        <SettingsIcon className="h-10 w-10 text-neutral-300" aria-hidden />
        <p className="text-sm font-bold text-black">เฉพาะผู้ดูแลระบบเท่านั้น</p>
        <p className="text-xs text-neutral-400">กรุณาเข้าสู่ระบบด้วยบัญชีผู้ดูแลระบบ</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <AdminHeader />

      <main className="mx-auto w-full max-w-5xl flex-1 space-y-5 px-4 py-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="flex items-center gap-2 text-lg font-bold text-black">
            <Webhook className="h-5 w-5" aria-hidden /> สถานะการเชื่อมต่อ
          </h1>
          <button
            onClick={() => load()}
            className="flex items-center gap-1.5 rounded-full border border-line px-3 py-2 text-xs font-semibold text-neutral-600 transition-colors hover:bg-neutral-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} aria-hidden /> รีเฟรช
          </button>
        </div>

        {error && (
          <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">
            <p role="alert">{error}</p>
            <button
              onClick={() => load()}
              className="mt-2 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-red-600 border border-red-100"
            >
              ลองอีกครั้ง
            </button>
          </div>
        )}

        <section
          aria-label="หมายเหตุความโปร่งใส"
          className="flex gap-3 rounded-3xl border border-[#FFE27A] bg-[#FFF4CC] p-4 text-sm"
        >
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-neutral-700" aria-hidden />
          <div>
            <p className="font-bold text-black">โปร่งใส: แสดงสถานะตามการตั้งค่าจริง</p>
            <p className="mt-1 text-xs leading-relaxed text-neutral-700">
              หน้านี้อ่านอย่างเดียว ไม่มีการบันทึกค่า — สถานะอ้างอิงคีย์ integration_* ใน platform_settings
              และ flag ฝั่ง build เท่านั้น ค่าที่เป็นความลับฝั่งเซิร์ฟเวอร์ (.env) อ่านจากเบราว์เซอร์ไม่ได้จึงระบุเป็นหมายเหตุ
            </p>
          </div>
        </section>

        {loading ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-32 animate-pulse rounded-3xl bg-neutral-100" />
            ))}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {CARDS.map(({ Icon, title, staticStatus, note, flagKey }) => {
              const override = dbOverride(rows, flagKey);
              const status: Status = override == null ? staticStatus : override ? 'ready' : 'not_connected';
              return (
                <article
                  key={title}
                  aria-label={`สถานะ${title}`}
                  className="flex flex-col gap-2 rounded-3xl border border-line bg-white p-4 shadow-sm"
                >
                  <div className="flex items-center gap-2">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#FFF4CC] text-black">
                      <Icon className="h-5 w-5" aria-hidden />
                    </span>
                    <h2 className="min-w-0 flex-1 truncate-1 text-sm font-bold text-black">{title}</h2>
                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${STATUS_BADGE[status]}`}>
                      {STATUS_LABEL[status]}
                    </span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-neutral-400">{note}</p>
                  {flagKey && (
                    <p className="text-[10px] text-neutral-400">
                      อ้างอิงคีย์ <code className="font-bold text-neutral-600">{flagKey}</code>
                      {override == null ? ' (ยังไม่มีใน platform_settings — ใช้สถานะคงที่ของระบบ)' : ' จาก platform_settings'}
                    </p>
                  )}
                </article>
              );
            })}
          </div>
        )}

        <section aria-label="คีย์ integration_* ในฐานข้อมูล" className="overflow-hidden rounded-3xl border border-line bg-white shadow-sm">
          <h2 className="border-b border-line bg-neutral-50 px-4 py-3 text-sm font-bold text-black">
            คีย์ integration_* ที่มีจริงใน platform_settings
          </h2>
          {loading ? (
            <div className="h-16 animate-pulse bg-neutral-100" />
          ) : rows.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <Webhook className="mx-auto h-8 w-8 text-neutral-300" aria-hidden />
              <p className="mt-2 text-sm text-neutral-400">ยังไม่มีคีย์ integration_* ในระบบ</p>
              <p className="mt-1 text-[11px] text-neutral-400">
                เพิ่มคีย์ได้ผ่านหน้าตั้งค่าแพลตฟอร์ม (เช่น integration_promptpay_enabled) — หน้านี้จะแสดงผลตามค่าที่มีจริง
              </p>
            </div>
          ) : (
            <ul>
              {rows.map((s, i) => (
                <li key={s.key} className={`px-4 py-3 ${i > 0 ? 'border-t border-line' : ''}`}>
                  <div className="flex flex-wrap items-center gap-2">
                    <code className="text-xs font-bold text-neutral-700">{s.key}</code>
                    <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-bold text-neutral-600">
                      {valueToText(s.value) === '' ? '(ค่าว่าง)' : valueToText(s.value)}
                    </span>
                    <span className="ml-auto text-[10px] text-neutral-400">{fmtMeta(s)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <p className="text-xs leading-relaxed text-neutral-400">
          หมายเหตุ: การปรับคีย์ integration_* ทำได้จากหน้า ตั้งค่าแพลตฟอร์ม — หน้านี้แสดงผลอย่างเดียวเพื่อความโปร่งใส
        </p>
      </main>

      <AdminFooter />
    </div>
  );
}
