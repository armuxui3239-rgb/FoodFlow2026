'use client';

import { useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import {
  Check,
  Database,
  FileText,
  Landmark,
  RefreshCw,
  Save,
  Settings as SettingsIcon,
  ShieldCheck,
} from 'lucide-react';
import { api, useSession } from '@/lib/client';
import { AdminFooter, AdminHeader } from '@/components/portal/admin-header';
import { Switch } from '@/components/ui/switch';

interface SettingRow {
  key: string;
  value: unknown;
  updated_at: string | null;
  updatedByName: string | null;
}

type RowMap = Record<string, SettingRow>;

interface TextField {
  key: string;
  label: string;
  kind: 'url' | 'string' | 'number';
  hint: string;
  unit?: string;
  placeholder?: string;
  defaultText?: string;
}

interface BoolField {
  key: string;
  label: string;
  hint: string;
}

/** ลิงก์เอกสารกฎหมาย — เว้นว่างได้, ถ้ากรอกต้องเป็น https:// */
const URL_FIELDS: TextField[] = [
  {
    key: 'compliance_tos_url',
    label: 'ลิงก์ข้อกำหนดและเงื่อนไข (ToS)',
    kind: 'url',
    hint: 'เอกสารข้อกำหนดการใช้บริการที่ผู้ใช้ยอมรับก่อนสั่งอาหาร',
    placeholder: 'https://…',
  },
  {
    key: 'compliance_privacy_url',
    label: 'ลิงก์นโยบายความเป็นส่วนตัว',
    kind: 'url',
    hint: 'นโยบายความเป็นส่วนตัวตาม พ.ร.บ.คุ้มครองข้อมูลส่วนบุคคล (PDPA)',
    placeholder: 'https://…',
  },
  {
    key: 'compliance_cookie_url',
    label: 'ลิงก์นโยบายคุกกี้',
    kind: 'url',
    hint: 'นโยบายการใช้คุกกี้และเทคโนโลยีติดตามบนเว็บไซต์',
    placeholder: 'https://…',
  },
];

/** ระยะเวลาเก็บรักษาข้อมูล — จำนวนเต็มไม่ติดลบ */
const NUM_FIELDS: TextField[] = [
  {
    key: 'compliance_retention_days',
    label: 'ข้อมูลส่วนบุคคลทั่วไป',
    kind: 'number',
    unit: 'วัน',
    hint: 'เก็บข้อมูลผู้ใช้ก่อนลบ/ทำให้ไม่ระบุตัวตน ตามหลักเก็บข้อมูลเท่าที่จำเป็นของ PDPA',
  },
  {
    key: 'compliance_audit_retention_days',
    label: 'บันทึกตรวจสอบ (audit log)',
    kind: 'number',
    unit: 'วัน',
    hint: 'ระยะเวลาเก็บบันทึกการกระทำของแอดมินเพื่อการตรวจสอบย้อนหลัง',
  },
  {
    key: 'compliance_orders_retention_days',
    label: 'ข้อมูลออเดอร์',
    kind: 'number',
    unit: 'วัน',
    hint: 'ระยะเวลาเก็บประวัติคำสั่งซื้อ/ใบเสร็จ ตามข้อบังคับทางบัญชีและภาษี',
  },
  {
    key: 'compliance_export_retention_hours',
    label: 'ไฟล์ส่งออกข้อมูล',
    kind: 'number',
    unit: 'ชั่วโมง',
    hint: 'อายุไฟล์ export ข้อมูลส่วนบุคคลก่อนถูกลบอัตโนมัติ เพื่อลดความเสี่ยงข้อมูลรั่ว',
  },
];

/** SLA ซัพพอร์ตวางในหมวดมาตรฐานบริการ (ไม่อยู่หมวดเก็บรักษาข้อมูล) */
const SLA_FIELD: TextField = {
  key: 'compliance_support_sla_hours',
  label: 'SLA ตอบกลับซัพพอร์ต',
  kind: 'number',
  unit: 'ชั่วโมง',
  hint: 'เป้าหมายตอบกลับเรื่องร้องเรียนของผู้ใช้ภายในกี่ชั่วโมง',
};

const STR_FIELDS: TextField[] = [
  {
    key: 'compliance_jurisdiction',
    label: 'เขตอำนาจศาล / กฎหมายที่ใช้',
    kind: 'string',
    hint: 'กฎหมายของประเทศที่ใช้ควบคุมข้อกำหนดและข้อพิพาท (ค่าเริ่มต้น ประเทศไทย)',
    defaultText: 'ประเทศไทย',
  },
  {
    key: 'compliance_vat_number',
    label: 'เลขประจำตัวผู้เสียภาษี',
    kind: 'string',
    hint: 'เลข 13 หลักของผู้ประกอบการ แสดงบนใบเสร็จเมื่อเปิดคิด VAT',
  },
];

/** สวิตช์บันทึกทันทีเมื่อสลับ (optimistic + rollback) */
const GDPR_BOOLEANS: BoolField[] = [
  {
    key: 'compliance_gdpr_consent_banner',
    label: 'แบนเนอร์ขอความยินยอมคุกกี้',
    hint: 'แสดงแบนเนอร์ขอความยินยอมก่อนเก็บคุกกี้ที่ไม่จำเป็น ตามหลักขอความยินยอมใน PDPA',
  },
  {
    key: 'compliance_gdpr_data_export',
    label: 'ให้ผู้ใช้ขอสำเนาข้อมูลตนเอง',
    hint: 'สิทธิเข้าถึงและขอสำเนา/พกพาข้อมูลส่วนบุคคลของผู้ใช้ตาม PDPA',
  },
  {
    key: 'compliance_gdpr_deletion_requests',
    label: 'ให้ผู้ใช้ขอลบข้อมูล',
    hint: 'สิทธิขอให้ลบหรือทำลายข้อมูลส่วนบุคคลเมื่อหมดวัตถุประสงค์การเก็บรักษา',
  },
];

const BIZ_BOOLEANS: BoolField[] = [
  {
    key: 'compliance_vat_enabled',
    label: 'เปิดคิดภาษีมูลค่าเพิ่ม (VAT)',
    hint: 'คิด/แสดง VAT ในหน้าสรุปราคาและใบเสร็จของออเดอร์',
  },
  {
    key: 'compliance_kyc_required',
    label: 'บังคับยืนยันตัวตน (KYC) ร้าน/ไรเดอร์',
    hint: 'ร้านค้าและไรเดอร์ต้องผ่านการตรวจเอกสารก่อนเปิดรับออเดอร์/รับงาน',
  },
];

const BOOL_FIELDS = [...GDPR_BOOLEANS, ...BIZ_BOOLEANS];
const TEXT_FIELDS = [...URL_FIELDS, ...NUM_FIELDS, ...STR_FIELDS, SLA_FIELD];
const KNOWN_KEYS = new Set([...TEXT_FIELDS, ...BOOL_FIELDS].map((f) => f.key));
const INT_RE = /^\d+$/;

function isHttpsUrl(text: string): boolean {
  try {
    return new URL(text).protocol === 'https:';
  } catch {
    return false;
  }
}

function readBool(v: unknown): boolean {
  return v === true || v === 'true';
}

function readString(v: unknown): string {
  if (typeof v === 'string') return v;
  if (v == null) return '';
  return String(v);
}

/** ค่าตัวเลขใน DB เป็น JSON number — อ่านเป็นข้อความสำหรับช่องกรอก */
function readNumText(v: unknown): string {
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) return String(Number(v));
  return '';
}

/** ข้อความค่า raw สำหรับคีย์อื่น ๆ ที่ไม่อยู่ในรายการหลัก */
function valueToText(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

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

/** ตรวจรายช่อง — คืนข้อความ error (ค่าว่างผ่านได้ = ยังไม่กำหนด) */
function validateField(f: TextField, raw: string): string {
  const t = raw.trim();
  if (t === '') return '';
  if (f.kind === 'url' && !isHttpsUrl(t)) return 'URL ต้องเป็นลิงก์เต็มที่ขึ้นต้นด้วย https://';
  if (f.kind === 'number' && !INT_RE.test(t)) return `ระบุเป็นจำนวนเต็มไม่ติดลบ (หน่วย: ${f.unit ?? '-'})`;
  return '';
}

/** ค่าเริ่มต้นของช่องกรอกจาก DB — ตัวเลขอ่านเป็นข้อความ, เขตอำนาจศาลเติมค่าเริ่มต้นเมื่อยังไม่มีคีย์ */
function draftFor(f: TextField, row: SettingRow | undefined): string {
  if (f.kind === 'number') return readNumText(row?.value);
  const s = readString(row?.value);
  if (s !== '') return s;
  return f.defaultText ?? '';
}

function fmtMeta(row: SettingRow | undefined): string {
  if (!row) return 'ยังไม่มีคีย์นี้ในระบบ — บันทึกเพื่อสร้าง';
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

function Section({ title, Icon, children }: { title: string; Icon: typeof FileText; children: ReactNode }) {
  return (
    <section aria-label={title} className="overflow-hidden rounded-3xl border border-line bg-white shadow-sm">
      <h2 className="flex items-center gap-2 border-b border-line bg-neutral-50 px-4 py-3 text-sm font-bold text-black">
        <Icon className="h-4 w-4" aria-hidden /> {title}
      </h2>
      <ul>{children}</ul>
    </section>
  );
}

function FieldMeta({ row }: { row: SettingRow | undefined }) {
  return <span className="ml-auto text-[10px] text-neutral-400">{fmtMeta(row)}</span>;
}

/** หน้าข้อกำหนด/ความเป็นส่วนตัว (C4) — URL เอกสาร, ระยะเวลาเก็บข้อมูล, สิทธิ PDPA, ภาษี/KYC (PATCH {key,value} upsert) */
export default function AdminCompliancePage() {
  const { user, ready, refresh } = useSession();
  const [rows, setRows] = useState<RowMap>({});
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [bools, setBools] = useState<Record<string, boolean>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [boolBusy, setBoolBusy] = useState<string | null>(null);
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
          if (row.key.startsWith('compliance_')) map[row.key] = row;
        }
        setRows(map);
        setBools((b) => {
          const next = { ...b };
          for (const f of BOOL_FIELDS) if (!(f.key in next)) next[f.key] = readBool(map[f.key]?.value);
          return next;
        });
        setDrafts((d) => {
          const next = { ...d };
          for (const f of TEXT_FIELDS) if (!(f.key in next)) next[f.key] = draftFor(f, map[f.key]);
          for (const row of r.data) {
            if (row.key.startsWith('compliance_') && !KNOWN_KEYS.has(row.key) && !(row.key in next)) {
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

  const setDraft = (key: string, text: string) => {
    setDrafts((d) => ({ ...d, [key]: text }));
    setFieldErrors((m) => (m[key] ? { ...m, [key]: '' } : m));
  };

  const markSaved = (key: string) => {
    setSavedKey(key);
    window.setTimeout(() => setSavedKey((k) => (k === key ? null : k)), 2000);
  };

  const touchRow = (key: string, value: unknown) => {
    setRows((r) => ({
      ...r,
      [key]: { key, value, updated_at: new Date().toISOString(), updatedByName: user?.fullName ?? null },
    }));
  };

  const saveOne = async (key: string): Promise<boolean> => {
    const field = TEXT_FIELDS.find((f) => f.key === key);
    const raw = (drafts[key] ?? '').trim();
    if (field) {
      const err = validateField(field, raw);
      setFieldErrors((m) => ({ ...m, [key]: err }));
      if (err) return false;
      if (field.kind === 'number' && raw === '') return true; // เว้นว่าง = ยังไม่ตั้งค่า ข้ามช่องนี้
    }
    setSavingKey(key);
    setError('');
    try {
      let value: unknown;
      if (!field) value = looseDraftToValue(raw);
      else if (field.kind === 'number') value = Number(raw);
      else value = raw;
      await api('/api/admin/settings', { method: 'PATCH', body: JSON.stringify({ key, value }) });
      touchRow(key, value);
      markSaved(key);
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setSavingKey(null);
    }
  };

  /** สลับบูลีนแบบ optimistic — ถ้า PATCH พลาดย้อนค่ากลับทันที */
  const toggleBool = async (key: string, next: boolean) => {
    if (boolBusy) return;
    const prev = bools[key] ?? false;
    setBools((b) => ({ ...b, [key]: next }));
    setBoolBusy(key);
    setError('');
    try {
      await api('/api/admin/settings', { method: 'PATCH', body: JSON.stringify({ key, value: next }) });
      touchRow(key, next);
      markSaved(key);
    } catch (e) {
      setBools((b) => ({ ...b, [key]: prev }));
      setError((e as Error).message);
    } finally {
      setBoolBusy(null);
    }
  };

  const saveAll = async () => {
    setSavingAll(true);
    setError('');
    let ok = true;
    for (const f of TEXT_FIELDS) {
      const done = await saveOne(f.key);
      if (!done) {
        ok = false;
        break;
      }
    }
    if (ok) load();
    setSavingAll(false);
  };

  const extraRows = Object.values(rows).filter((r) => !KNOWN_KEYS.has(r.key));

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

  const renderTextField = (f: TextField, bordered: boolean) => {
    const isSaved = savedKey === f.key;
    const meta = rows[f.key];
    const dbText = f.kind === 'number' ? readNumText(meta?.value) : readString(meta?.value);
    const unchanged = dbText !== '' && (drafts[f.key] ?? '').trim() === dbText.trim();
    return (
      <li key={f.key} className={`px-4 py-3 ${bordered ? 'border-t border-line' : ''}`}>
        <div className="flex flex-wrap items-center gap-2">
          <code className="text-xs font-bold text-neutral-700">{f.key}</code>
          <FieldMeta row={meta} />
        </div>
        <p className="mt-1 text-xs font-semibold text-black">{f.label}</p>
        <p className="mt-0.5 text-[11px] leading-relaxed text-neutral-400">{f.hint}</p>
        <div className="mt-2 flex gap-2">
          <input
            value={drafts[f.key] ?? ''}
            onChange={(e) => setDraft(f.key, e.target.value)}
            inputMode={f.kind === 'number' ? 'numeric' : undefined}
            placeholder={f.placeholder ?? (f.kind === 'number' ? `0 (${f.unit})` : undefined)}
            aria-label={`${f.label} (${f.key})${f.unit ? ` หน่วย ${f.unit}` : ''}`}
            className="h-11 flex-1 rounded-2xl border border-line bg-white px-4 text-sm text-black outline-none focus:border-black"
          />
          {f.kind === 'number' && <span className="flex h-11 items-center text-xs text-neutral-400">{f.unit}</span>}
          <button
            onClick={() => void saveOne(f.key)}
            disabled={savingKey === f.key || savingAll || unchanged}
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
  };

  const renderBoolField = (f: BoolField, bordered: boolean) => {
    const meta = rows[f.key];
    return (
      <li key={f.key} className={`px-4 py-3 ${bordered ? 'border-t border-line' : ''}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <code className="text-xs font-bold text-neutral-700">{f.key}</code>
              <FieldMeta row={meta} />
            </div>
            <p className="mt-1 text-xs font-semibold text-black">{f.label}</p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-neutral-400">{f.hint}</p>
          </div>
          <Switch
            checked={bools[f.key] ?? false}
            onCheckedChange={(checked) => void toggleBool(f.key, checked)}
            disabled={Boolean(boolBusy)}
            aria-label={`${f.label} (${f.key})`}
          />
        </div>
        {savedKey === f.key && (
          <p className="mt-1 flex items-center gap-1 text-[11px] text-emerald-600">
            <Check className="h-3.5 w-3.5" aria-hidden /> บันทึกแล้ว
          </p>
        )}
      </li>
    );
  };

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <AdminHeader />

      <main className="mx-auto w-full max-w-6xl flex-1 space-y-5 px-4 py-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="flex items-center gap-2 text-lg font-bold text-black">
            <ShieldCheck className="h-5 w-5" aria-hidden /> ข้อกำหนด / ความเป็นส่วนตัว
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
              <Save className="h-3.5 w-3.5" aria-hidden /> {savingAll ? 'กำลังบันทึกทั้งหน้า…' : 'บันทึกช่องกรอกทั้งหมด'}
            </button>
          </div>
        </div>

        {error && (
          <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </p>
        )}

        <p className="text-xs leading-relaxed text-neutral-400">
          คีย์ที่ยังไม่มีใน platform_settings จะถูกสร้างอัตโนมัติเมื่อบันทึก (upsert) — สวิตช์บันทึกทันทีเมื่อสลับ
          และจะย้อนกลับเองหากบันทึกไม่สำเร็จ ช่องตัวเลขที่เว้นว่างจะไม่ถูกบันทึก (ยังไม่กำหนด)
        </p>

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-40 animate-pulse rounded-3xl bg-neutral-100" />
            ))}
          </div>
        ) : (
          <>
            <Section title="เอกสารข้อกำหนดและนโยบาย" Icon={FileText}>
              {URL_FIELDS.map((f, i) => renderTextField(f, i > 0))}
            </Section>

            <Section title="ระยะเวลาเก็บรักษาข้อมูล" Icon={Database}>
              {NUM_FIELDS.map((f, i) => renderTextField(f, i > 0))}
            </Section>

            <Section title="สิทธิผู้ใช้ตาม PDPA" Icon={ShieldCheck}>
              {GDPR_BOOLEANS.map((f, i) => renderBoolField(f, i > 0))}
            </Section>

            <Section title="ภาษี ตัวตน และมาตรฐานบริการ" Icon={Landmark}>
              {STR_FIELDS.map((f, i) => renderTextField(f, i > 0))}
              {BIZ_BOOLEANS.map((f) => renderBoolField(f, true))}
              {renderTextField(SLA_FIELD, true)}
            </Section>

            {extraRows.length > 0 && (
              <Section title="คีย์ compliance_* อื่น ๆ ที่มีในระบบ" Icon={FileText}>
                {extraRows.map((s, i) => (
                  <li key={s.key} className={`px-4 py-3 ${i > 0 ? 'border-t border-line' : ''}`}>
                    <div className="flex flex-wrap items-center gap-2">
                      <code className="text-xs font-bold text-neutral-700">{s.key}</code>
                      <FieldMeta row={s} />
                    </div>
                    <div className="mt-2 flex gap-2">
                      <input
                        value={drafts[s.key] ?? ''}
                        onChange={(e) => setDraft(s.key, e.target.value)}
                        aria-label={`ค่าของ ${s.key}`}
                        className="h-11 flex-1 rounded-2xl border border-line bg-white px-4 text-sm text-black outline-none focus:border-black"
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
              </Section>
            )}
          </>
        )}
      </main>

      <AdminFooter />
    </div>
  );
}
