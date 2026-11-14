// Seed ข้อมูลตั้งต้นพอร์ทัล (admin/restaurant/driver) — ยิงตรง PostgREST ของ Supabase จริง
// ทุกอย่าง idempotent: GET ก่อนเสมอ → มีอยู่แล้ว = ข้าม → ไม่มี = POST (ใส่ id/created_at เอง เพราะ DB จริงไม่มี default)
// env เท่านั้น: SUPABASE_URL + SUPABASE_SERVICE_KEY (หรือ SBK) — ห้าม hardcode/พิมพ์คีย์
// รัน: node --env-file=.env scripts/seed-portal-data.mjs
import crypto from 'node:crypto';

const URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_KEY ?? process.env.SBK;
if (!URL || !KEY) {
  console.error('ต้องมี SUPABASE_URL และ SUPABASE_SERVICE_KEY (หรือ SBK) ใน .env');
  process.exit(1);
}
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', Prefer: 'return=representation' };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// query รับได้ทั้ง object (URLSearchParams) และ string ที่ encode ไว้แล้ว
// (string จำเป็นเมื่อ filter เป็นข้อความไทยมีเว้นวรรค — ต้อง %20 เพราะ PostgREST ไม่ถอด '+')
async function req(t, q, method, body, extraHeaders) {
  const qs = typeof q === 'string' ? q : new URLSearchParams(q ?? {}).toString();
  const url = `${URL}/rest/v1/${t}${qs ? `?${qs}` : ''}`;
  for (let attempt = 0; attempt < 3; attempt++) {
    const r = await fetch(url, { method: method ?? 'GET', headers: { ...H, ...extraHeaders }, body: body ? JSON.stringify(body) : undefined });
    const text = await r.text();
    if (r.ok) { await sleep(80); return text ? JSON.parse(text) : []; }
    console.error(`! ${r.status} ${t}: ${text.slice(0, 150)}`);
    if (r.status === 401 || r.status === 403) process.exit(1);
    await sleep(1500 * (attempt + 1));
  }
  throw new Error(`ล้มเหลวถาวร: ${t}`);
}

const get = (t, q) => req(t, q);

// นับจำนวนแถวแบบ exact (ใช้ Content-Range จาก Prefer: count=exact)
async function count(t, q = '') {
  const qs = `${q}${q ? '&' : ''}select=id&limit=1`;
  for (let attempt = 0; attempt < 3; attempt++) {
    const r = await fetch(`${URL}/rest/v1/${t}?${qs}`, {
      headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, Prefer: 'count=exact' },
    });
    if (r.ok) {
      await r.text();
      const cr = r.headers.get('content-range'); // เช่น "0-0/42" หรือ "*/0"
      const total = cr ? Number(cr.split('/')[1]) : NaN;
      await sleep(80);
      if (Number.isNaN(total)) throw new Error(`อ่าน Content-Range ไม่ได้: ${t}`);
      return total;
    }
    const text = await r.text();
    console.error(`! ${r.status} ${t}: ${text.slice(0, 150)}`);
    if (r.status === 401 || r.status === 403) process.exit(1);
    await sleep(1500 * (attempt + 1));
  }
  throw new Error(`นับแถวล้มเหลวถาวร: ${t}`);
}

const now = () => new Date().toISOString();
const uuid = () => crypto.randomUUID();

// คีย์ที่หน้าตั้งค่า admin / PATCH /api/admin/settings ใช้รูปจัดรูปแบบ { key, value }
const SETTINGS = [
  { key: 'site_name', value: 'ฟู๊ด ธันเดอร์' },
  { key: 'maintenance_mode', value: false },
  { key: 'registration_enabled', value: true },
  { key: 'currency', value: 'THB' },
  { key: 'timezone', value: 'Asia/Bangkok' },
  { key: 'delivery_fee_satang', value: 3500 },
  { key: 'support_email', value: '' },
  { key: 'support_phone', value: '' },
];

// ข้อความสำเร็จรูปภูมิใจไทย 4 แบบ (created_by_id เป็น NOT NULL → ต้องใช้ id แอดมินจริง)
const MACROS = [
  { name: 'ทักทายลูกค้า', body: 'สวัสดีครับ มีอะไรให้ช่วยไหมครับ', tags: ['greeting'] },
  { name: 'ขออภัยความล่าช้า', body: 'ขออภัยในความล่าช้าครับ เรากำลังเร่งตรวจสอบให้ทันที', tags: ['delay'] },
  { name: 'แนวทางเงินคืน', body: 'กรณีสินค้าผิด/ขาด เราจะดำเนินการคืนเงินตามนโยบายภายใน 3 วันทำการ', tags: ['refund'] },
  { name: 'ปิดเรื่อง', body: 'ขอบคุณที่แจ้งครับ เรื่องนี้เรียบร้อยแล้ว', tags: ['close'] },
];

// enum จริงใน DB: TicketIssueType=late_delivery | TicketPriority=medium | TicketStatus=open | SupportChannel=in_app เท่านั้น
const TICKETS = [
  { summary: 'อาหารส่งช้ากว่าปกติ 30 นาที' },
  { summary: 'ไรเดอร์ติดต่อไม่ได้ระหว่างจัดส่ง' },
];

const NOTIFS = [
  { title: 'ยินดีต้อนรับสู่ฟู๊ด ธันเดอร์', body: 'เปิดรับงานได้จากหน้าหลัก', type: 'system' },
  { title: 'แคมเปญค่าตอแทน', body: 'ตรวจสอบแคมเปญโบนัสได้ที่เมนูแรงจูงใจ', type: 'promo' },
];

async function main() {
  const ins = { settings: 0, macros: 0, tickets: 0, notifs: 0 };
  const skip = { settings: 0, macros: 0, tickets: 0, notifs: 0 };

  // ---------- 1) platform_settings ----------
  const existingSettings = await get('platform_settings', { select: 'key', limit: '1000' });
  const settingKeys = new Set(existingSettings.map((s) => s.key));
  for (const s of SETTINGS) {
    if (settingKeys.has(s.key)) { skip.settings++; continue; }
    await req('platform_settings', {}, 'POST', {
      id: uuid(), key: s.key, value: s.value, updated_by_id: null, updated_at: now(),
    });
    ins.settings++;
    console.log(`  + platform_settings: ${s.key}`);
  }

  // ---------- ผู้ใช้จริง: แอดมิน / ลูกค้า 2 คน / ไรเดอร์ 1 คน ----------
  const admins = await get('users', { role: 'eq.admin', select: 'id,full_name', limit: '1' });
  if (!admins.length) {
    console.error('ไม่พบผู้ใช้ role=admin — support_macros.created_by_id เป็น NOT NULL จึงต้องมีแอดมินจริง');
    process.exit(1);
  }
  const adminId = admins[0].id;

  const customers = await get('users', { role: 'eq.customer', select: 'id,full_name', limit: '2' });
  if (customers.length < 2) {
    console.error(`ต้องมีผู้ใช้ role=customer อย่างน้อย 2 คน (เจอ ${customers.length})`);
    process.exit(1);
  }

  const drivers = await get('users', { role: 'eq.driver', select: 'id,full_name', limit: '1' });
  if (!drivers.length) {
    console.error('ไม่พบผู้ใช้ role=driver — ต้องมีไรเดอร์จริงอย่างน้อย 1 คน');
    process.exit(1);
  }
  const driverId = drivers[0].id;

  // ---------- 2) support_macros ----------
  const existingMacros = await get('support_macros', { select: 'name', limit: '1000' });
  const macroNames = new Set(existingMacros.map((m) => m.name));
  for (const m of MACROS) {
    if (macroNames.has(m.name)) { skip.macros++; continue; }
    const ts = now();
    await req('support_macros', {}, 'POST', {
      id: uuid(), name: m.name, body: m.body, tags: m.tags, is_active: true,
      created_by_id: adminId, created_at: ts, updated_at: ts,
    });
    ins.macros++;
    console.log(`  + support_macros: ${m.name}`);
  }

  // ---------- 3) ai_support_tickets (2 เรื่อง OPEN ของลูกค้าจริง) ----------
  for (let i = 0; i < TICKETS.length; i++) {
    const t = TICKETS[i];
    const cust = customers[i % customers.length];
    const dup = await get(
      'ai_support_tickets',
      `user_id=eq.${cust.id}&summary=eq.${encodeURIComponent(t.summary)}&select=id&limit=1`,
    );
    if (dup.length) { skip.tickets++; continue; }
    const ts = now();
    await req('ai_support_tickets', {}, 'POST', {
      id: uuid(), user_id: cust.id, order_id: null,
      issue_type: 'late_delivery', summary: t.summary, priority: 'medium', status: 'open',
      assigned_admin_id: null, resolution_notes: null,
      created_at: ts, resolved_at: null, channel: 'in_app', tags: ['seed'], updated_at: ts,
    });
    ins.tickets++;
    console.log(`  + ai_support_tickets: ${t.summary}`);
  }

  // ---------- 4) notifications (2 แจ้งเตือนของไรเดอร์จริง) ----------
  for (const n of NOTIFS) {
    const dup = await get(
      'notifications',
      `user_id=eq.${driverId}&title=eq.${encodeURIComponent(n.title)}&select=id&limit=1`,
    );
    if (dup.length) { skip.notifs++; continue; }
    await req('notifications', {}, 'POST', {
      id: uuid(), user_id: driverId, title: n.title, body: n.body,
      type: n.type, data: {}, is_read: false, created_at: now(),
    });
    ins.notifs++;
    console.log(`  + notifications: ${n.title}`);
  }

  // ---------- สรุป ----------
  console.log(`platform_settings  เพิ่ม ${ins.settings} | ข้าม ${skip.settings}`);
  console.log(`support_macros     เพิ่ม ${ins.macros} | ข้าม ${skip.macros}`);
  console.log(`ai_support_tickets เพิ่ม ${ins.tickets} | ข้าม ${skip.tickets}`);
  console.log(`notifications      เพิ่ม ${ins.notifs} | ข้าม ${skip.notifs}`);

  // ---------- ตรวจสอบย้อนหลังด้วย REST ----------
  const [nSettings, nMacros, nTickets, nOpenTickets, nNotifs] = await Promise.all([
    count('platform_settings'),
    count('support_macros'),
    count('ai_support_tickets'),
    count('ai_support_tickets', 'status=eq.open'),
    count('notifications', `user_id=eq.${driverId}`),
  ]);
  console.log(`ตรวจสอบ: platform_settings ${nSettings} แถว | support_macros ${nMacros} แถว | ai_support_tickets ${nTickets} แถว (open ${nOpenTickets}) | แจ้งเตือนของไรเดอร์ ${nNotifs} แถว`);
}

main().catch((e) => { console.error(e); process.exit(1); });
