// audit-db-truth.mjs — ตรวจความจริงฐานข้อมูลรวมจุดในคำสั่งเจ้าของ "ตรวจความจริงทุกหมด"
// ใช้: node scripts/audit-db-truth.mjs   (อ่าน DIRECT_URL จาก .env — ตรวจอ่านอย่างเดียว ไม่เขียน)
import { readFileSync } from 'fs';
import pg from 'pg';

const env = Object.fromEntries(
  readFileSync('.env', 'utf8')
    .split(/\r?\n/)
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
);
const cs = env.DIRECT_URL || env.DATABASE_URL;
if (!cs) {
  console.error('ไม่มี DIRECT_URL/DATABASE_URL ใน .env');
  process.exit(1);
}

const client = new pg.Client({ connectionString: cs, ssl: false });
await client.connect();

const q = async (sql, label) => {
  try {
    const res = await client.query(sql);
    return { label, rows: res.rows };
  } catch (err) {
    return { label, rows: [{ ข้อผิดพลาด: `${err.code ?? ''} ${err.message.split('\n')[0].slice(0, 160)}` }] };
  }
};

const out = [];

// 1) enum LocaleCode — 'th' เพิ่มแล้วหรือยัง (P0 #5 + decision #8)
out.push(await q(`select enumlabel from pg_enum e join pg_type t on e.enumtypid = t.oid where t.typname = 'LocaleCode' order by enumsortorder`, '1) enum LocaleCode'));

// 2) preferred_locale ทุกบัญชี + อีเมล foodflow.vn ตกค้าง
out.push(await q(`select preferred_locale, count(*)::int as n from users group by 1 order by 2 desc`, '2a) preferred_locale ของ users'));
out.push(await q(`select count(*)::int as foodflow_vn_emails from users where email like '%foodflow.vn%'`, '2b) อีเมล foodflow.vn ตกค้าง'));

// 3) RLS — ตาราง user เปิดครบหรือยัง
out.push(await q(`select count(*)::int as total_user_tables from pg_tables where schemaname='public'`, '3a) ตาราง public รวม'));
out.push(await q(`select count(*)::int as rls_on from pg_class c join pg_namespace n on c.relnamespace = n.oid where n.nspname='public' and c.relkind='r' and c.relrowsecurity`, '3b) ตารางเปิด RLS'));

// 4) ตารางหมวด D — ข้อมูลจริงใช้งานจริงหรือไม่
out.push(await q(`select 'dispatch_offers' t, count(*)::int n from dispatch_offers union all select 'staff_shifts', count(*)::int from staff_shifts union all select 'payout_ledger', count(*)::int from payout_ledger union all select 'driver_location_history', count(*)::int from driver_location_history union all select 'realtime_outbox', count(*)::int from realtime_outbox union all select 'payment_refund_requests', count(*)::int from payment_refund_requests order by t`, '4) ตารางหมวด D (แถวจริง)'));

// 5) loyalty — มีตารางแต้มอะไรบ้าง + มีข้อมูลไหม (P1 ⏳ สะสมแต้มตอนสั่ง)
out.push(await q(`select tablename from pg_tables where schemaname='public' and (tablename ilike '%loyal%' or tablename ilike '%point%')`, '5a) ตาราง loyalty/points ที่มีจริง'));
out.push(await q(`select count(*)::int as n from loyalty_transactions`, '5b) loyalty_transactions แถวจริง').catch(() => ({ label: '5b) loyalty_transactions', rows: [{ n: 'ไม่มีตาราง' }] })));

// 6) แจ้งเตือน/ออเดอร์ทดสอบยอด 1-5 บาท (รอนโยบาย)
out.push(await q(`select count(*)::int as tiny_test_orders from orders where total between 100 and 500`, '6) ออเดอร์ทดสอบยอด ฿1–฿5'));

// 7) seed ตามข้อ 8 — ร้าน/เมนู/เหตุผลยกเลิก ตรงเอกสารหรือไม่
out.push(await q(`select count(*)::int as restaurants from restaurant_profiles`, '7a) ร้าน'));
out.push(await q(`select count(*)::int as menu_items from menu_items`, '7b) เมนู'));
out.push(await q(`select count(*)::int as cancel_reasons from cancellation_reasons where is_active`, '7c) เหตุผลยกเลิก (active)'));
out.push(await q(`select count(*)::int as locales from languages`, '7d) languages'));

for (const { label, rows } of out) {
  console.log(`\n${label}`);
  console.log(JSON.stringify(rows.rows ?? rows, null, 0).slice(0, 600));
}

await client.end();
console.log('\nตรวจเสร็จ — อ่านอย่างเดียว ไม่มีการเขียนฐานข้อมูล');
