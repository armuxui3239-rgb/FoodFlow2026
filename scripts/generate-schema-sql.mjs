// ============================================================
// สร้าง supabase/schema.sql จาก OpenAPI จริงของ PostgREST
// - ตาราง/คอลัมน์/ชนิด/PK/FK/NOT NULL จาก OpenAPI spec
// - ค่า enum รื้อจาก DISTINCT ของข้อมูลจริงในตาราง
// - defaults ที่จำเป็นต่อการใช้งานจริง (id/created_at/is_active ฯลฯ)
// รัน: SUPABASE_URL=... SUPABASE_SERVICE_KEY=... bun scripts/generate-schema-sql.mjs
// ============================================================
const URL_ = process.env.SUPABASE_URL || 'https://lgjwrxrhbksdbzorcwwb.supabase.co';
const KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SBK || '';
if (!KEY) { console.error('ต้องมี SUPABASE_SERVICE_KEY'); process.exit(1); }

const SKIP = new Set(['_prisma_migrations', 'geography_columns', 'geometry_columns', 'spatial_ref_sys']);

async function get(path) {
  const res = await fetch(`${URL_}/rest/v1/${path}`, {
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
  });
  if (!res.ok) throw new Error(`${path}: ${res.status} ${await res.text()}`);
  return res.json();
}

const spec = await get('/?apikey=' + KEY);
const defs = spec.definitions || {};
const tables = Object.keys(defs).filter((t) => !SKIP.has(t)).sort();

// ---- 1) เก็บชนิด enum ทั้งหมด + ตาราง/คอลัมน์ที่ใช้ ----
const enumCols = {}; // "Table.col" -> enumName
const enumNames = new Set();
for (const [t, td] of Object.entries(defs)) {
  if (SKIP.has(t)) continue;
  for (const [c, p] of Object.entries(td.properties || {})) {
    const f = p.format || '';
    if (f.startsWith('public."')) {
      const name = f.slice('public."'.length, -1);
      enumCols[`${t}.${c}`] = name;
      enumNames.add(name);
    } else if (f.startsWith('public.') && !f.includes('(')) {
      // enum ชื่อไม่มีตัวพิมพ์ใหญ่ (ไม่พบในโปรเจกต์นี้ — กันไว้)
      enumCols[`${t}.${c}`] = f.slice('public.'.length);
      enumNames.add(f.slice('public.'.length));
    }
  }
}

// ---- 2) รื้อค่า enum จาก DISTINCT ข้อมูลจริง ----
const enumValues = {}; // enumName -> sorted values
for (const [tc, enumName] of Object.entries(enumCols)) {
  if (enumValues[enumName]) continue;
  const [t, c] = tc.split('.');
  try {
    const rows = await get(`${t}?select=${c}&limit=2000`);
    const vals = [...new Set(rows.map((r) => r[c]).filter((v) => v != null))];
    if (vals.length > 0) enumValues[enumName] = vals.sort();
  } catch (e) {
    console.error(`DISTINCT ${tc} ล้มเหลว: ${e.message}`);
  }
}
// enum ที่ข้อมูลยังไม่ครบทุกค่า — เติมจากความรู้ในโค้ดแอป (route ตรวจค่าเหล่านี้จริง)
const knownExtras = {
  OrderStatus: ['cancelled', 'completed', 'delivered', 'delivering', 'driver_assigned', 'picked_up', 'pending_payment', 'preparing', 'ready_for_pickup', 'refunded', 'restaurant_accepted', 'paid'],
  RestaurantApprovalStatus: ['approved', 'pending', 'rejected', 'suspended'],
  PromotionStatus: ['active', 'inactive', 'expired'],
  // ค่าที่พิสูจน์ได้จากโค้ดแอปจริง
  WalletTxnType: ['credit', 'debit'], // คอมเมนต์ใน src/app/api/wallet/topup/route.ts
  KycStatus: ['pending', 'approved', 'rejected'], // ค่าที่โค้ดค้นพบจริง
  DeliveryTaskStatus: ['assigned', 'picked_up', 'delivered'], // tasks route insert 'assigned' + update 'picked_up' (ระบบจริงทำงานสำเร็จทุกวัน)
  // ตาราง placeholder ที่ยังไม่มีโค้ดเขียน (ai_usage_events/admin_export_jobs/staff_*/support_*)
  // ใส่ค่าตามธรรมเนียมทั่วไปเพื่อให้ติดตั้งผ่าน — ปรับได้ภายหลัง (ไม่มีผลต่อการใช้งานปัจจุบัน)
  AiUsageOutcome: ['success', 'error'],
  ExportFormat: ['csv', 'xlsx', 'json'],
  ExportJobStatus: ['pending', 'running', 'completed', 'failed'],
  StaffInviteStatus: ['invited', 'accepted', 'expired', 'revoked'],
  StaffShiftStatus: ['scheduled', 'in_progress', 'completed', 'cancelled'],
  SupportMessageType: ['message', 'note', 'system'],
};
for (const [k, vals] of Object.entries(knownExtras)) {
  if (!enumValues[k]) enumValues[k] = [];
  for (const v of vals) if (!enumValues[k].includes(v)) enumValues[k].push(v);
}

// ---- 3) defaults ที่ระบบต้องใช้จริง (แอป insert โดยไม่ส่งคอลัมน์เหล่านี้) ----
const DEFAULTS = {
  id: 'gen_random_uuid()', // ทุกตาราง PK uuid ที่แอป insert ไม่ส่ง id
  created_at: 'now()',
  updated_at: 'now()',
  is_active: 'true',
  is_open: 'true',
  is_available: 'true',
  is_popular: 'false',
  is_hidden: 'false',
  is_online: 'false',
  is_stackable: 'false',
  first_order_only: 'false',
  usage_count: '0',
  current_usage_count: '0',
  used_budget: '0',
  budget: '0',
  failed_login_count: '0',
  quantity: '1',
  sort_order: '0',
  total_deliveries: '0',
  total_earnings: '0',
  status: null, // สถานะต่างกันตามตาราง — ไม่เดา ให้แอป/seed ส่งเอง (โค้ดแอปทำอยู่แล้ว)
};

// ---- 4) แปลง format → SQL type ----
function sqlType(fmt) {
  if (fmt === 'uuid') return 'uuid';
  if (fmt === 'text') return 'text';
  if (fmt === 'integer' || fmt === 'int32') return 'integer';
  if (fmt === 'bigint' || fmt === 'int64') return 'bigint';
  if (fmt === 'boolean') return 'boolean';
  if (fmt === 'jsonb') return 'jsonb';
  if (fmt === 'json') return 'json';
  if (fmt === 'date') return 'date';
  if (fmt === 'numeric') return 'numeric';
  if (fmt === 'bigint with precision' || fmt === 'numeric with precision') return 'numeric';
  if (fmt === 'double precision' || fmt === 'double' || fmt === 'float64' || fmt === 'float8') return 'double precision';
  if (fmt === 'real' || fmt === 'float32' || fmt === 'float4') return 'real';
  if (fmt === 'tsvector') return 'tsvector';
  if (fmt === 'inet') return 'inet';
  if (fmt === 'timestamp with time zone') return 'timestamptz';
  if (fmt === 'timestamp without time zone') return 'timestamp';
  if (fmt === 'time without time zone') return 'time';
  if (fmt === 'character varying') return 'character varying(255)';
  if (fmt.startsWith('character varying(')) return fmt.replace('character varying', 'varchar');
  if (fmt.startsWith('character(')) return fmt;
  if (fmt.startsWith('numeric(')) return fmt;
  if (fmt.startsWith('public."')) return `"${fmt.slice('public."'.length, -1)}"`;
  if (fmt.startsWith('public.geography')) return 'geography(Point,4326)';
  if (fmt.startsWith('public.vector')) return 'vector(1536)';
  if (fmt === 'ARRAY') return 'text[]'; // PostgREST ไม่บอกชนิดย่อย — ระบบนี้ใช้ text[] (channels, cuisine_types, photos)
  if (fmt.startsWith('public.')) return fmt.slice('public.'.length);
  return fmt || 'text';
}

// ---- 5) FK map ----
const fks = []; // { table, column, refTable, refColumn }
for (const [t, td] of Object.entries(defs)) {
  if (SKIP.has(t)) continue;
  for (const [c, p] of Object.entries(td.properties || {})) {
    const d = p.description || '';
    const m = d.match(/<fk table='([^']+)' column='([^']+)'\/>/);
    if (m) fks.push({ table: t, column: c, refTable: m[1], refColumn: m[2] });
  }
}

// ---- 6) ประกอบไฟล์ SQL ----
const L = [];
L.push('-- ============================================================');
L.push('-- ฟู๊ด ธันเดอร์ (FoodFlow2026) — สคีมาฐานข้อมูล Supabase/Postgres');
L.push('-- สร้างอัตโนมัติจากโปรเจกต์จริง (OpenAPI + ข้อมูลจริง) วันที่ 2026-11-09');
L.push('-- วิธีใช้: Supabase ใหม่ → SQL Editor → รันไฟล์นี้ทั้งหมด → รัน scripts/seed-thai.mjs');
L.push('-- หมายเหตุ: ต้องเปิดส่วนเสริม PostGIS และ pgcrypto ตามคำสั่งด้านล่าง');
L.push('-- ============================================================');
L.push('');
L.push('CREATE EXTENSION IF NOT EXISTS pgcrypto;');
L.push('CREATE EXTENSION IF NOT EXISTS postgis;');
L.push('CREATE EXTENSION IF NOT EXISTS vector; -- สำหรับ rag_documents.embedding vector(1536)');
L.push('');
L.push('-- ---------- ชนิด enum (รื้อค่าจากข้อมูลจริง) ----------');
for (const name of [...enumNames].sort()) {
  const vals = enumValues[name];
  if (!vals || vals.length === 0) { console.error(`!! enum ${name} ไม่มีค่า — ต้องเติมเอง`); continue; }
  const vs = vals.map((v) => `'${v.replace(/'/g, "''")}'`).join(', ');
  L.push(`CREATE TYPE "${name}" AS ENUM (${vs});`);
}
L.push('');
L.push('-- ---------- ตาราง (ไม่มี FK — ใส่ท้ายไฟล์เพื่อไม่ติดลำดับ) ----------');
for (const t of tables) {
  const td = defs[t];
  const props = td.properties || {};
  const required = new Set(td.required || []);
  L.push(`CREATE TABLE ${t} (`);
  const lines = [];
  for (const [c, p] of Object.entries(props)) {
    const fmt = p.format || '';
    let line = `  ${c} ${sqlType(fmt)}`;
    const desc = p.description || '';
    if (desc.includes('<pk/>')) line += ' PRIMARY KEY';
    else if (fmt === 'uuid' && DEFAULTS.id && c === 'id') line += ` DEFAULT ${DEFAULTS.id}`;
    if (desc.includes('This is a default value')) {
      const m = desc.match(/default value[.:]?\s*(.+)/);
      if (m) line += ` DEFAULT ${m[1].trim()}`;
    }
    if (required.has(c) && !desc.includes('<pk/>')) line += ' NOT NULL';
    if (!required.has(c) && !desc.includes('<pk/>')) {
      // nullable — เว้นไว้ (Postgres default = NULL) ยกเว้นมี default ที่ระบบใช้
      if (DEFAULTS[c] && fmt !== 'uuid') line += ` DEFAULT ${DEFAULTS[c]}`;
    }
    lines.push(line);
  }
  L.push(lines.join(',\n'));
  L.push(');');
  L.push('');
}
L.push('-- ---------- Foreign Keys ----------');
const seenFk = new Set();
for (const fk of fks) {
  const key = `${fk.table}.${fk.column}->${fk.refTable}.${fk.refColumn}`;
  if (seenFk.has(key)) continue;
  seenFk.add(key);
  const cname = `fk_${fk.table}_${fk.column}`.slice(0, 63);
  L.push(`ALTER TABLE ${fk.table} ADD CONSTRAINT ${cname} FOREIGN KEY (${fk.column}) REFERENCES ${fk.refTable}(${fk.refColumn});`);
}
L.push('');
L.push('-- จบสคีมา — ขั้นถัดไป: bun scripts/seed-thai.mjs (ต้องตั้ง SUPABASE_URL + SBK ก่อน)');

const fs = await import('fs');
fs.mkdirSync('supabase', { recursive: true });
fs.writeFileSync('supabase/schema.sql', L.join('\n') + '\n');
console.log(`เขียน supabase/schema.sql: ${tables.length} ตาราง, ${enumNames.size} enum (${[...enumNames].filter((n) => !enumValues[n]?.length).length} ไม่มีค่า), ${seenFk.size} FK`);
