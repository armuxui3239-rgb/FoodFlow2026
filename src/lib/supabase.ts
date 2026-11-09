import 'server-only';
import crypto from 'crypto';

const URL = process.env.SUPABASE_URL!;
const KEY = process.env.SUPABASE_SERVICE_KEY!;

export function sbHeaders(): HeadersInit {
  return { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };
}

export async function sbList<T>(
  table: string,
  params: Record<string, string> = {},
): Promise<T[]> {
  const qs = new URLSearchParams(params);
  const res = await fetch(`${URL}/rest/v1/${table}?${qs}`, {
    headers: sbHeaders(),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Supabase ${table}: ${res.status}`);
  return res.json();
}

export async function sbOne<T>(table: string, params: Record<string, string>): Promise<T | null> {
  const rows = await sbList<T>(table, params);
  return rows[0] ?? null;
}

/** ตารางที่เทมเพลตกำหนด NOT NULL แต่ไม่มีค่า default — ต้องใส่ค่าเองตอน insert */
const TS_ALL = new Set(['carts', 'orders', 'users']);
const TS_CREATED = new Set(['payments']);

function withId(table: string, body: Record<string, unknown>): Record<string, unknown> {
  if (body.id === undefined) body.id = crypto.randomUUID();
  const now = new Date().toISOString();
  if (TS_ALL.has(table)) {
    body.created_at ??= now;
    body.updated_at ??= now;
  } else if (TS_CREATED.has(table)) {
    body.created_at ??= now;
  }
  return body;
}

export async function sbInsert<T>(table: string, body: unknown): Promise<T[]> {
  const payload = Array.isArray(body)
    ? body.map((b) => withId(table, { ...b }))
    : withId(table, { ...(body as Record<string, unknown>) });
  const res = await fetch(`${URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: { ...sbHeaders(), Prefer: 'return=representation' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Supabase insert ${table}: ${await res.text()}`);
  return res.json();
}

export async function sbUpdate<T>(
  table: string,
  params: Record<string, string>,
  body: unknown,
): Promise<T[]> {
  const qs = new URLSearchParams(params);
  const res = await fetch(`${URL}/rest/v1/${table}?${qs}`, {
    method: 'PATCH',
    headers: { ...sbHeaders(), Prefer: 'return=representation' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Supabase update ${table}: ${await res.text()}`);
  return res.json();
}

export async function sbDelete(table: string, params: Record<string, string>): Promise<void> {
  const qs = new URLSearchParams(params);
  const res = await fetch(`${URL}/rest/v1/${table}?${qs}`, { method: 'DELETE', headers: sbHeaders() });
  if (!res.ok) throw new Error(`Supabase delete ${table}: ${res.status}`);
}

export async function sbRpc<T>(fn: string, args: unknown): Promise<T> {
  const res = await fetch(`${URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: sbHeaders(),
    body: JSON.stringify(args),
  });
  if (!res.ok) throw new Error(`Supabase rpc ${fn}: ${await res.text()}`);
  return res.json();
}
