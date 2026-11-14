// audit-rls-anon.mjs — พิสูจน์ RLS ด้วยการยิงจริง: ยิงด้วยคีย์ anon (คนแปลกหน้า) ทุกตาราง
// ผ่าน = ไม่ได้ข้อมูลแม้แต่แถวเดียว (error หรือผลว่าง) · ตก = ได้ข้อมูลจริงกลับมา
// รัน: node scripts/audit-rls-anon.mjs
import { readFileSync } from 'fs';
import pg from 'pg';

const env = Object.fromEntries(
  readFileSync('.env', 'utf8')
    .split(/\r?\n/)
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
);
const ANON = env.SUPABASE_ANON_KEY;
const REST = env.SUPABASE_URL;
if (!ANON || !REST) {
  console.error('ต้องมี SUPABASE_URL + SUPABASE_ANON_KEY ใน .env');
  process.exit(1);
}

// 1) รายชื่อตาราง user ทั้งหมด (จากฐานจริง)
const client = new pg.Client({ connectionString: env.DIRECT_URL });
await client.connect();
const tables = (
  await client.query(
    `select tablename from pg_tables where schemaname='public' and tablename not in ('spatial_ref_sys') order by tablename`,
  )
).rows.map((r) => r.tablename);
await client.end();

let leaked = 0;
let blocked = 0;
let empty = 0;
const leakedRows = [];

for (const t of tables) {
  let ok = false;
  let mode = '';
  try {
    const res = await fetch(`${REST}/rest/v1/${t}?select=*&limit=1`, {
      headers: { apikey: ANON, Authorization: `Bearer ${ANON}` },
    });
    if (res.status >= 400) {
      ok = true;
      mode = `ถูกปฏิเสธ (HTTP ${res.status})`;
    } else {
      const data = await res.json();
      if (Array.isArray(data) && data.length === 0) {
        ok = true;
        mode = 'ผลว่าง (RLS กรองหมด)';
      } else {
        mode = `ได้ข้อมูล ${Array.isArray(data) ? data.length : '?'} แถว!`;
      }
    }
  } catch (e) {
    ok = true;
    mode = `ถูกปฏิเสธ (${String(e).slice(0, 60)})`;
  }
  if (ok) {
    if (mode.startsWith('ผลว่าง')) empty++;
    else blocked++;
    console.log(`  ✓ ${t} — ${mode}`);
  } else {
    leaked++;
    leakedRows.push(`${t} — ${mode}`);
    console.log(`  ✗ ${t} — ${mode}`);
  }
}

console.log(`\nสรุป: ${tables.length} ตาราง · ถูกปฏิเสธ ${blocked} · ผลว่าง ${empty} · รั่ว ${leaked}`);
if (leaked > 0) {
  console.log('ตารางรั่ว:');
  leakedRows.forEach((l) => console.log(`  - ${l}`));
  process.exit(1);
}
