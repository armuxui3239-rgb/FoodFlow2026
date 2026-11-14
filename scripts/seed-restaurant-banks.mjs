// seed-restaurant-banks.mjs — ใส่บัญชีธนาคารตั้งต้นให้ร้านทุกร้าน (เจ้าของแก้ไขเองภายหลังได้)
// ตามคำสั่งเจ้าของ 2026-11-15: ใส่ข้อมูลตั้งต้นไปก่อน เพราะร้านต้องอัปเดตแก้ไขบัญชีอยู่ดี
// ตั้งต้น: ธนาคารกรุงเทพ · เลข 0000000000 (ตัวอย่างชัดเจน ไม่ใช่บัญชีจริง) · ชื่อบัญชี = ชื่อร้าน
// รันได้ซ้ำ (ข้ามร้านที่มีบัญชีแล้ว): node scripts/seed-restaurant-banks.mjs
import { readFileSync } from 'fs';

const env = Object.fromEntries(
  readFileSync('.env', 'utf8')
    .split(/\r?\n/)
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
);
const URL = env.SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_KEY;
if (!URL || !KEY) {
  console.error('ต้องมี SUPABASE_URL + SUPABASE_SERVICE_KEY ใน .env');
  process.exit(1);
}
const headers = {
  apikey: KEY,
  Authorization: `Bearer ${KEY}`,
  'Content-Type': 'application/json',
};

const res = await fetch(`${URL}/rest/v1/restaurants?select=id,name,bank_name,bank_account_number`, { headers });
const rows = await res.json();
if (!Array.isArray(rows)) {
  console.error('อ่านร้านไม่สำเร็จ:', JSON.stringify(rows).slice(0, 200));
  process.exit(1);
}

let updated = 0;
let skipped = 0;
for (const r of rows) {
  if (r.bank_name && r.bank_account_number) {
    skipped++;
    continue;
  }
  const patch = await fetch(`${URL}/rest/v1/restaurants?id=eq.${r.id}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({
      bank_name: 'ธนาคารกรุงเทพ',
      bank_account_number: '0000000000',
      bank_account_name: r.name,
    }),
  });
  if (patch.ok) updated++;
  else console.error(`แก้ร้าน ${r.name} ไม่สำเร็จ: HTTP ${patch.status}`);
}

console.log(`ตั้งต้นให้ ${updated} ร้าน · ข้าม (มีบัญชีแล้ว) ${skipped} · รวม ${rows.length} ร้าน`);
