'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Check, RefreshCw, Settings as SettingsIcon } from 'lucide-react';
import { api } from '@/lib/client';
import { AdminFooter, AdminHeader } from '@/components/portal/admin-header';

interface SettingRow {
  id: string;
  key: string;
  value: unknown;
  updated_at: string | null;
  updatedByName: string | null;
}

/** หัวข้อไทยตามคำนำหน้า key ก่อนขีดล่างแรก */
const GROUP_TH: Record<string, string> = {
  brand: 'แบรนด์',
  payment: 'ชำระเงิน',
  delivery: 'จัดส่ง',
  app: 'แอป',
};

function groupLabel(prefix: string): string {
  return GROUP_TH[prefix] ?? 'ทั่วไป';
}

function valueToText(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

/** แปลงข้อความในช่องกรอกเป็นค่า JSON ก่อนส่ง — พยายาม parse (ตัวเลข/บูลีน/วัตถุ) ถ้าไม่ได้ส่งเป็นข้อความ */
function draftToValue(text: string): unknown {
  const trimmed = text.trim();
  if (trimmed === '') return '';
  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (typeof parsed === 'number' || typeof parsed === 'boolean' || typeof parsed === 'object') return parsed;
    return text; // ข้อความล้วน (รวมกรณีมีเครื่องหมายคำพูดครอบ) ส่งเป็นสตริงตามที่พิมพ์
  } catch {
    return text;
  }
}

/** หน้าค่าตั้งค่าแพลตฟอร์ม — จัดกลุ่มตามคำนำหน้า key และบันทึกรายแถว (PATCH {key,value} upsert) */
export default function AdminSettingsPage() {
  const [rows, setRows] = useState<SettingRow[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    api<{ data: SettingRow[] }>('/api/admin/settings')
      .then((r) => {
        setRows(r.data);
        setDrafts(Object.fromEntries(r.data.map((s) => [s.key, valueToText(s.value)])));
        setError('');
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = async (key: string) => {
    setSavingKey(key);
    setError('');
    try {
      await api('/api/admin/settings', {
        method: 'PATCH',
        body: JSON.stringify({ key, value: draftToValue(drafts[key] ?? '') }),
      });
      setSavedKey(key);
      setTimeout(() => setSavedKey(null), 2000);
      load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSavingKey(null);
    }
  };

  // จัดกลุ่มตามคำนำหน้าก่อนขีดล่างแรก รักษาลำดับตัวอักษรของ key
  const groups = new Map<string, SettingRow[]>();
  for (const r of rows) {
    const prefix = r.key.includes('_') ? r.key.slice(0, r.key.indexOf('_')) : r.key;
    const list = groups.get(prefix) ?? [];
    list.push(r);
    groups.set(prefix, list);
  }

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <AdminHeader />

      <main className="mx-auto w-full max-w-6xl flex-1 space-y-5 px-4 py-5">
        <div className="flex items-center justify-between gap-2">
          <h1 className="flex items-center gap-2 text-lg font-bold text-black">
            <SettingsIcon className="h-5 w-5" aria-hidden /> ตั้งค่าแพลตฟอร์ม
          </h1>
          <button
            onClick={() => load()}
            className="flex items-center gap-1.5 rounded-full border border-line px-3 py-2 text-xs font-semibold text-neutral-600 transition-colors hover:bg-neutral-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} aria-hidden /> รีเฟรช
          </button>
        </div>

        <p className="flex flex-wrap items-center gap-1.5 text-xs text-neutral-500">
          <span className="font-semibold text-neutral-600">หน้าย่อย:</span>
          <Link href="/admin/settings/branding" className="rounded-full bg-[#FFF4CC] px-3 py-1.5 font-bold text-black transition-colors hover:bg-[#FFC400]">
            แบรนด์
          </Link>
          <span aria-hidden>·</span>
          <Link href="/admin/settings/compliance" className="rounded-full bg-[#FFF4CC] px-3 py-1.5 font-bold text-black transition-colors hover:bg-[#FFC400]">
            ข้อกำหนด
          </Link>
          <span aria-hidden>·</span>
          <Link href="/admin/settings/integrations" className="rounded-full bg-[#FFF4CC] px-3 py-1.5 font-bold text-black transition-colors hover:bg-[#FFC400]">
            การเชื่อมต่อ
          </Link>
        </p>

        {error && (
          <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </p>
        )}

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-32 animate-pulse rounded-3xl bg-neutral-100" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-line px-4 py-10 text-center">
            <SettingsIcon className="mx-auto h-8 w-8 text-neutral-300" aria-hidden />
            <p className="mt-2 text-sm text-neutral-400">ยังไม่มีค่าตั้งค่าในระบบ</p>
          </div>
        ) : (
          [...groups.entries()].map(([prefix, list]) => (
            <section key={prefix} aria-label={`ตั้งค่า${groupLabel(prefix)}`} className="overflow-hidden rounded-3xl border border-line bg-white shadow-sm">
              <h2 className="border-b border-line bg-neutral-50 px-4 py-3 text-sm font-bold text-black">{groupLabel(prefix)}</h2>
              <ul>
                {list.map((s, i) => (
                  <li key={s.id} className={`px-4 py-3 ${i > 0 ? 'border-t border-line' : ''}`}>
                    <div className="flex flex-wrap items-center gap-2">
                      <code className="text-xs font-bold text-neutral-700">{s.key}</code>
                      <span className="ml-auto text-[10px] text-neutral-400">
                        {s.updated_at
                          ? `อัปเดต ${new Date(s.updated_at).toLocaleString('th-TH', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}${s.updatedByName ? ` โดย ${s.updatedByName}` : ''}`
                          : 'ยังไม่เคยแก้ไข'}
                      </span>
                    </div>
                    <div className="mt-2 flex gap-2">
                      <input
                        value={drafts[s.key] ?? ''}
                        onChange={(e) => setDrafts((d) => ({ ...d, [s.key]: e.target.value }))}
                        aria-label={`ค่าของ ${s.key}`}
                        className="h-11 flex-1 rounded-2xl border border-line bg-white px-4 text-sm text-black outline-none focus:border-black"
                      />
                      <button
                        onClick={() => void save(s.key)}
                        disabled={savingKey === s.key || (drafts[s.key] ?? '') === valueToText(s.value)}
                        className="btn-brand flex h-11 w-24 shrink-0 items-center justify-center gap-1 text-xs disabled:opacity-50"
                      >
                        {savedKey === s.key ? (
                          <>
                            <Check className="h-4 w-4" aria-hidden /> บันทึกแล้ว
                          </>
                        ) : savingKey === s.key ? (
                          'กำลังบันทึก…'
                        ) : (
                          'บันทึก'
                        )}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}
      </main>

      <AdminFooter />
    </div>
  );
}
