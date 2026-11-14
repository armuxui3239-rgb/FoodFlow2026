'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check, Image as ImageIcon, Palette, RefreshCw, Save, Settings as SettingsIcon, Store } from 'lucide-react';
import { api, useSession } from '@/lib/client';
import { AdminFooter, AdminHeader } from '@/components/portal/admin-header';

interface SettingRow {
  key: string;
  value: unknown;
  updated_at: string | null;
  updatedByName: string | null;
}

type RowMap = Record<string, SettingRow>;

interface BrandField {
  key: string;
  label: string;
  kind: 'text' | 'email' | 'tel' | 'color' | 'url';
  hint: string;
  placeholder?: string;
}

/** คีย์ที่หน้านี้ดูแล — ชื่อแพลตฟอร์ม (site_name) + กลุ่ม branding_* (สร้างใหม่ได้ด้วย PATCH upsert) */
const FIELDS: BrandField[] = [
  { key: 'site_name', label: 'ชื่อแพลตฟอร์ม', kind: 'text', hint: 'ชื่อที่แสดงบนเว็บและแอป เช่น ฟู๊ด ธันเดอร์' },
  { key: 'branding_tagline', label: 'แท็กไลน์', kind: 'text', hint: 'ประโยคสั้นใต้ชื่อแบรนด์ เช่น อาหารไทยถึงไว ส่งร้อนทุกจาน' },
  { key: 'support_email', label: 'อีเมลซัพพอร์ต', kind: 'email', hint: 'แสดงในหน้าช่วยเหลือและอีเมลแจ้งเตือนถึงผู้ใช้' },
  { key: 'support_phone', label: 'โทรศัพท์ซัพพอร์ต', kind: 'tel', hint: 'เบอร์ติดต่อทีมซัพพอร์ต เช่น 021234567' },
  { key: 'branding_primary_color', label: 'สีหลัก', kind: 'color', hint: 'โทนสีหลักของแบรนด์ รูปแบบ #RRGGBB (เว้นว่าง = ยังไม่กำหนด)' },
  { key: 'branding_accent_color', label: 'สีรอง', kind: 'color', hint: 'โทนสีเน้นจุดสำคัญร่วมกับสีหลัก รูปแบบ #RRGGBB' },
  { key: 'branding_logo_url', label: 'URL โลโก้', kind: 'url', hint: 'ลิงก์รูปโลโก้ (https:// เท่านั้น) — เว้นว่างได้', placeholder: 'https://…' },
  { key: 'branding_favicon_url', label: 'URL favicon', kind: 'url', hint: 'ลิงก์ไฟล์ favicon เล็ก 32x32 (https:// เท่านั้น)', placeholder: 'https://…' },
  { key: 'branding_og_image_url', label: 'URL OG image', kind: 'url', hint: 'รูปตอนแชร์ลงโซเชียล แนะนำ 1200x630 (https:// เท่านั้น)', placeholder: 'https://…' },
];

const KNOWN_KEYS = new Set(FIELDS.map((f) => f.key));
const HEX_RE = /^#[0-9a-fA-F]{6}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const FALLBACK_PRIMARY = '#FFC400';
const FALLBACK_ACCENT = '#171717';

function readString(v: unknown): string {
  if (typeof v === 'string') return v;
  if (v == null) return '';
  return String(v);
}

/** ข้อความค่า raw สำหรับคีย์อื่น ๆ ที่ไม่อยู่ในรายการหลัก (เช่น ตัวเลข/บูลีน) */
function valueToText(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

/** แปลงข้อความของคีย์อื่น ๆ เป็นค่า JSON — parse ตัวเลข/บูลีน/วัตถุ ถ้าไม่ได้ส่งเป็นสตริง */
function looseDraftToValue(text: string): unknown {
  const trimmed = text.trim();
  if (trimmed === '') return '';
  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (typeof parsed === 'number' || typeof parsed === 'boolean' || typeof parsed === 'object') return parsed;
    return text;
  } catch {
    return text;
  }
}

function isHttpsUrl(text: string): boolean {
  try {
    return new URL(text).protocol === 'https:';
  } catch {
    return false;
  }
}

/** ตรวจความถูกต้องรายช่อง — คืนข้อความ error (ค่าว่าง = ยังไม่กำหนด ผ่านได้) */
function validateField(f: BrandField, raw: string): string {
  const t = raw.trim();
  if (t === '') return '';
  if (f.kind === 'color' && !HEX_RE.test(t)) return 'รูปแบบสีไม่ถูกต้อง ต้องเป็น #RRGGBB เช่น #FFC400';
  if (f.kind === 'url' && !isHttpsUrl(t)) return 'URL ต้องเป็นลิงก์เต็มที่ขึ้นต้นด้วย https://';
  if (f.kind === 'email' && !EMAIL_RE.test(t)) return 'รูปแบบอีเมลไม่ถูกต้อง';
  return '';
}

/** เลือกสีตัวอักษรดำ/ขาวบนพื้นสีที่กำหนด เพื่อให้ตัวอย่างอ่านได้จริง */
function readableText(hex: string): string {
  const n = hex.replace('#', '');
  const r = parseInt(n.slice(0, 2), 16);
  const g = parseInt(n.slice(2, 4), 16);
  const b = parseInt(n.slice(4, 6), 16);
  return 0.299 * r + 0.587 * g + 0.114 * b > 160 ? '#000000' : '#ffffff';
}

function fmtMeta(row: SettingRow | undefined): string {
  if (!row) return 'ยังไม่มีคีย์นี้ในระบบ — กดบันทึกเพื่อสร้าง';
  if (!row.updated_at) return 'มีในระบบ (ไม่ทราบเวลาอัปเดต)';
  const time = new Date(row.updated_at).toLocaleString('th-TH', {
    day: '2-digit',
    month: 'short',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
  return row.updatedByName ? `อัปเดต ${time} โดย ${row.updatedByName}` : `อัปเดต ${time}`;
}

/** หน้าตั้งค่าแบรนด์ (C3) — ชื่อแพลตฟอร์ม/สี/ลิงก์รูป บันทึกทีละช่องหรือทั้งกลุ่มผ่าน PATCH {key,value} upsert */
export default function AdminBrandingPage() {
  const { user, ready, refresh } = useSession();
  const [rows, setRows] = useState<RowMap>({});
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const [savingAll, setSavingAll] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const load = useCallback(() => {
    setLoading(true);
    api<{ data: SettingRow[] }>('/api/admin/settings')
      .then((r) => {
        const map: RowMap = {};
        for (const row of r.data) {
          if (row.key === 'site_name' || row.key.startsWith('branding_')) map[row.key] = row;
        }
        setRows(map);
        setDrafts((d) => {
          const next = { ...d };
          for (const f of FIELDS) if (!(f.key in next)) next[f.key] = readString(map[f.key]?.value);
          for (const row of r.data) {
            if (row.key.startsWith('branding_') && !KNOWN_KEYS.has(row.key) && !(row.key in next)) {
              next[row.key] = valueToText(row.value);
            }
          }
          return next;
        });
        setError('');
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const saveValue = async (key: string, value: unknown): Promise<boolean> => {
    try {
      await api('/api/admin/settings', { method: 'PATCH', body: JSON.stringify({ key, value }) });
      setRows((r) => ({
        ...r,
        [key]: { key, value, updated_at: new Date().toISOString(), updatedByName: user?.fullName ?? null },
      }));
      setSavedKey(key);
      window.setTimeout(() => setSavedKey((k) => (k === key ? null : k)), 2000);
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    }
  };

  const saveOne = async (key: string): Promise<boolean> => {
    const field = FIELDS.find((f) => f.key === key);
    const raw = (drafts[key] ?? '').trim();
    if (field) {
      const err = validateField(field, raw);
      setFieldErrors((m) => ({ ...m, [key]: err }));
      if (err) return false;
    }
    setSavingKey(key);
    setError('');
    try {
      return await saveValue(key, field ? raw : looseDraftToValue(raw));
    } finally {
      setSavingKey(null);
    }
  };

  const saveAll = async () => {
    setSavingAll(true);
    setError('');
    let ok = true;
    for (const f of FIELDS) {
      const done = await saveOne(f.key);
      if (!done) {
        ok = false;
        break;
      }
    }
    if (ok) load();
    setSavingAll(false);
  };

  const setDraft = (key: string, text: string) => {
    setDrafts((d) => ({ ...d, [key]: text }));
    setFieldErrors((m) => (m[key] ? { ...m, [key]: '' } : m));
  };

  const extraRows = Object.values(rows).filter((r) => !KNOWN_KEYS.has(r.key));

  const primaryRaw = (drafts.branding_primary_color ?? '').trim();
  const primary = HEX_RE.test(primaryRaw) ? primaryRaw : FALLBACK_PRIMARY;
  const accentRaw = (drafts.branding_accent_color ?? '').trim();
  const accent = HEX_RE.test(accentRaw) ? accentRaw : FALLBACK_ACCENT;
  const previewName = (drafts.site_name ?? '').trim() || 'ฟู๊ด ธันเดอร์';
  const previewTagline = (drafts.branding_tagline ?? '').trim();
  const logoRaw = (drafts.branding_logo_url ?? '').trim();
  const previewLogo = isHttpsUrl(logoRaw) ? logoRaw : '';

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
            <Palette className="h-5 w-5" aria-hidden /> ตั้งค่าแบรนด์
          </h1>
          <div className="flex gap-2">
            <button
              onClick={() => load()}
              className="flex items-center gap-1.5 rounded-full border border-line px-3 py-2 text-xs font-semibold text-neutral-600 transition-colors hover:bg-neutral-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} aria-hidden /> รีเฟรช
            </button>
            <button
              onClick={() => void saveAll()}
              disabled={savingAll || loading}
              className="btn-brand flex items-center gap-1.5 rounded-full px-4 py-2 text-xs disabled:opacity-50"
            >
              <Save className="h-3.5 w-3.5" aria-hidden /> {savingAll ? 'กำลังบันทึกทั้งกลุ่ม…' : 'บันทึกทั้งกลุ่ม'}
            </button>
          </div>
        </div>

        {error && (
          <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </p>
        )}

        {/* ตัวอย่างแบรนด์จากค่าที่พิมพ์อยู่ (ยังไม่บันทึก) */}
        <section aria-label="ตัวอย่างแบรนด์" className="rounded-3xl border border-line bg-white p-4 shadow-sm">
          <p className="text-sm font-bold text-black">ตัวอย่างแบบเรียลไทม์</p>
          <p className="mt-0.5 text-[11px] text-neutral-400">แสดงจากค่าในช่องกรอกด้านล่าง — ยังไม่บันทึกจนกว่าจะกดบันทึก</p>
          <div className="mt-3 flex flex-wrap items-center gap-3 rounded-2xl bg-neutral-50 p-4">
            <span
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl"
              style={{ backgroundColor: primary }}
            >
              {previewLogo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={previewLogo} alt="โลโก้ตัวอย่าง" className="h-9 w-9 rounded-xl bg-white object-contain p-0.5" />
              ) : (
                <Store className="h-6 w-6" style={{ color: readableText(primary) }} aria-hidden />
              )}
            </span>
            <div className="min-w-0">
              <p className="truncate-1 text-base font-bold text-black">{previewName}</p>
              {previewTagline && <p className="truncate-1 text-xs text-neutral-500">{previewTagline}</p>}
            </div>
            <span className="ml-auto flex flex-wrap gap-2">
              <span className="rounded-full px-3 py-1.5 text-xs font-bold" style={{ backgroundColor: primary, color: readableText(primary) }}>
                ปุ่มสีหลัก
              </span>
              <span className="rounded-full px-3 py-1.5 text-xs font-bold" style={{ backgroundColor: accent, color: readableText(accent) }}>
                ปุ่มสีรอง
              </span>
            </span>
          </div>
        </section>

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-32 animate-pulse rounded-3xl bg-neutral-100" />
            ))}
          </div>
        ) : (
          <section aria-label="ฟิลด์แบรนด์" className="overflow-hidden rounded-3xl border border-line bg-white shadow-sm">
            <h2 className="border-b border-line bg-neutral-50 px-4 py-3 text-sm font-bold text-black">ข้อมูลและสื่อของแบรนด์</h2>
            <ul>
              {FIELDS.map((f, i) => {
                const isSaved = savedKey === f.key;
                const isColor = f.kind === 'color';
                const colorOk = isColor && HEX_RE.test((drafts[f.key] ?? '').trim());
                return (
                  <li key={f.key} className={`px-4 py-3 ${i > 0 ? 'border-t border-line' : ''}`}>
                    <div className="flex flex-wrap items-center gap-2">
                      <code className="text-xs font-bold text-neutral-700">{f.key}</code>
                      <span className="text-xs text-neutral-400">{f.label}</span>
                      <span className="ml-auto text-[10px] text-neutral-400">{fmtMeta(rows[f.key])}</span>
                    </div>
                    <p className="mt-1 text-[11px] leading-relaxed text-neutral-400">{f.hint}</p>
                    <div className="mt-2 flex gap-2">
                      <input
                        value={drafts[f.key] ?? ''}
                        onChange={(e) => setDraft(f.key, e.target.value)}
                        type={isColor ? 'text' : f.kind === 'email' ? 'email' : f.kind === 'tel' ? 'tel' : 'text'}
                        inputMode={f.kind === 'tel' ? 'tel' : undefined}
                        placeholder={f.placeholder}
                        aria-label={`${f.label} (${f.key})`}
                        className="h-11 flex-1 rounded-2xl border border-line bg-neutral-50 px-4 text-sm text-black outline-none focus:border-[#FFC400]"
                      />
                      {isColor && (
                        <input
                          type="color"
                          value={colorOk ? (drafts[f.key] ?? '').trim() : FALLBACK_PRIMARY}
                          onChange={(e) => setDraft(f.key, e.target.value.toUpperCase())}
                          aria-label={`เลือก${f.label}`}
                          className="h-11 w-12 shrink-0 cursor-pointer rounded-2xl border border-line bg-neutral-50 p-1"
                        />
                      )}
                      <button
                        onClick={() => void saveOne(f.key)}
                        disabled={savingKey === f.key || savingAll || (drafts[f.key] ?? '') === readString(rows[f.key]?.value)}
                        className="btn-brand flex h-11 w-24 shrink-0 items-center justify-center gap-1 text-xs disabled:opacity-50"
                      >
                        {isSaved ? (
                          <>
                            <Check className="h-4 w-4" aria-hidden /> บันทึกแล้ว
                          </>
                        ) : savingKey === f.key ? (
                          'กำลังบันทึก…'
                        ) : (
                          'บันทึก'
                        )}
                      </button>
                    </div>
                    {fieldErrors[f.key] && (
                      <p role="alert" className="mt-1.5 text-[11px] text-red-600">
                        {fieldErrors[f.key]}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {extraRows.length > 0 && (
          <section aria-label="คีย์แบรนด์อื่น ๆ" className="overflow-hidden rounded-3xl border border-line bg-white shadow-sm">
            <h2 className="flex items-center gap-2 border-b border-line bg-neutral-50 px-4 py-3 text-sm font-bold text-black">
              <ImageIcon className="h-4 w-4" aria-hidden /> คีย์ branding_* อื่น ๆ ที่มีในระบบ
            </h2>
            <ul>
              {extraRows.map((s, i) => (
                <li key={s.key} className={`px-4 py-3 ${i > 0 ? 'border-t border-line' : ''}`}>
                  <div className="flex flex-wrap items-center gap-2">
                    <code className="text-xs font-bold text-neutral-700">{s.key}</code>
                    <span className="ml-auto text-[10px] text-neutral-400">{fmtMeta(s)}</span>
                  </div>
                  <div className="mt-2 flex gap-2">
                    <input
                      value={drafts[s.key] ?? ''}
                      onChange={(e) => setDraft(s.key, e.target.value)}
                      aria-label={`ค่าของ ${s.key}`}
                      className="h-11 flex-1 rounded-2xl border border-line bg-neutral-50 px-4 text-sm text-black outline-none focus:border-[#FFC400]"
                    />
                    <button
                      onClick={() => void saveOne(s.key)}
                      disabled={savingKey === s.key || savingAll}
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
        )}

        <p className="text-xs leading-relaxed text-neutral-400">
          หมายเหตุ: การบันทึกสร้างคีย์ใหม่ใน platform_settings อัตโนมัติเมื่อยังไม่มี (upsert) — สีเว้นว่างหมายถึงยังไม่กำหนด
          และลิงก์รูปทั้งหมดต้องเป็น https:// เท่านั้น
        </p>
      </main>

      <AdminFooter />
    </div>
  );
}
