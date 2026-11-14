// seed-phase7.mjs — ข้อมูลตั้งต้นเฟส 7 (UI-ALIGNMENT-PLAN / v4 ข้อ 8)
// ทุกอย่าง idempotent: GET ก่อนเสมอ → มีอยู่แล้ว = ข้าม
// รัน: node --env-file=.env scripts/seed-phase7.mjs
//  1) เหตุผลยกเลิก 9 เหตุผล (v4 8.11)
//  2) เมนูครบ 8 ต่อร้าน (v4 8.4 — เติมเฉพาะร้านที่ขาด)
//  3) ร้านใหม่ กาฬสินธุ์ + ขอนแก่น พร้อมเจ้าของ + เวลาเปิด + เมนู 8 รายการ (v4 8.3)
//  4) ธุรกรรมกระเป๋าเงินตัวอย่างย้อนหลายวัน (v4 8.9)
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';

const URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_KEY ?? process.env.SBK;
if (!URL || !KEY) {
  console.error('ต้องมี SUPABASE_URL และ SUPABASE_SERVICE_KEY (หรือ SBK) ใน .env');
  process.exit(1);
}
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', Prefer: 'return=representation' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function req(t, q, method, body) {
  const qs = typeof q === 'string' ? q : new URLSearchParams(q ?? {}).toString();
  const url = `${URL}/rest/v1/${t}${qs ? `?${qs}` : ''}`;
  for (let attempt = 0; attempt < 3; attempt++) {
    const r = await fetch(url, { method: method ?? 'GET', headers: H, body: body ? JSON.stringify(body) : undefined });
    const text = await r.text();
    if (r.ok) { await sleep(60); return text ? JSON.parse(text) : []; }
    console.error(`! ${r.status} ${t}: ${text.slice(0, 200)}`);
    if (r.status === 401 || r.status === 403) process.exit(1);
    await sleep(1200 * (attempt + 1));
  }
  throw new Error(`ล้มเหลวถาวร: ${t}`);
}
const get = (t, q) => req(t, q);
const uuid = () => crypto.randomUUID();
const now = () => new Date().toISOString();
const daysAgoIso = (d) => new Date(Date.now() - d * 86400000).toISOString();

// v4 ข้อ 8.11 — เหตุผลยกเลิก 9 ข้อ (แอดมินแก้ไข/ปิดได้จากหน้า /admin/cancel-reasons)
const CANCEL_REASONS = [
  'รอนานเกินไป',
  'ติดต่อไรเดอร์ไม่ได้',
  'ไรเดอร์ปฏิเสธไปจุดหมาย',
  'ไรเดอร์ปฏิเสธมารับ',
  'ที่อยู่ผิด',
  'ราคาไม่สมเหตุสมผล',
  'อยากสั่งร้านอื่น',
  'แค่อยากยกเลิก',
  'อื่น ๆ',
];

// เมนูเติมทั่วไป { ชื่อ: [คำอธิบาย, ราคาบาท, หมวด] } — เติมร้านที่เมนูไม่ถึง 8
const MENU_POOL = [
  ['ข้าวผัดกุ้ง', 'ข้าวผัดกุ้งสดหอยน้ำปู สูตรครัวไทย', 70, 'ข้าว'],
  ['ผัดไทยกุ้งสด', 'ผัดไทยวัตถุดิบสด รสชาติกำลังดี', 60, 'ก๋วยเตี๋ยว'],
  ['ต้มยำกุ้งน้ำข้น', 'ต้มยำกุ้งน้ำข้น หอมขิง ตะไคร้', 120, 'อาหารไทย'],
  ['ไก่ทอดกรอบ 6 ชิ้น', 'ไก่ทอดกรอบนอกนุ่มใน ทานคู่ข้าวเหนียว', 50, 'ไก่ทอด'],
  ['ข้าวมันไก่ต้มกระดูก', 'ข้าวมันไก่นุ่ม พร้อมน้ำซุปใส', 55, 'ข้าวมันไก่'],
  ['แกงเขียวหวานไก่', 'แกงเขียวหวานไก่ ใส่มะระ โหระพา', 75, 'อาหารไทย'],
  ['ข้าวไข่เจียวหมูสับ', 'ข้าวราดไข่เจียวกรอบ หมูสับผัด', 45, 'ข้าว'],
  ['ชานมไข่มุกไข่เค็ม', 'ชานมไข่มุกเคี้ยวมัน หอมชาไทย', 35, 'เครื่องดื่ม'],
  ['ส้มตำไทย', 'ส้มตำไทยรสกลาง ใส่ถั่วฝักยาว', 50, 'ส้มตำ'],
  ['ก๋วยเตี๋ยวหมูน้ำใส', 'เส้นนุ่มน้ำใสกระดูกหมู หอมกลิ่นคาราเมล', 55, 'ก๋วยเตี๋ยว'],
];

// ร้านใหม่ 2 ร้าน (v4 8.3 — กาฬสินธุ์ + ขอนแก่น) พร้อมเมนูอีสาน 8 รายการ
const NEW_RESTAURANTS = [
  {
    slug: 'isan-zap-kalasin', name: 'อีสานแซ่บกาฬสินธุ์', city: 'กาฬสินธุ์', district: 'เมืองกาฬสินธุ์',
    address: '99 ถ.ศรีจันทร์ ต.กาฬสินธุ์ อ.เมืองกาฬสินธุ์ จ.กาฬสินธุ์ 46000',
    lat: 16.4398, lng: 103.7075, phone: '043800111',
    desc: 'ลาบเค็ม ซี๊ดหวาน สูตรถิ่นกาฬสินธุ์ พร้อมปลาดิบสดใหม่ทุกวัน',
  },
  {
    slug: 'khruea-khonkaen', name: 'ครัวขอนแก่น', city: 'ขอนแก่น', district: 'เมืองขอนแก่น',
    address: '88 ถ.มิตรภาพ ต.ในเมือง อ.เมืองขอนแก่น จ.ขอนแก่น 40000',
    lat: 16.4419, lng: 102.836, phone: '043220222',
    desc: 'ครัวอีสานแท้จากขอนแก่น ตำแซ่บ ไก่ย่างขุนอ้อ ข้าวเหนียวหอม',
  },
];
const ISAN_MENU = [
  ['ลาบหมู', 'ลาบหมูรสซี๊ดหวาน ใส่ข้าวคั่วหอม', 60, 'อาหารอีสาน'],
  ['ตำป่าหมูกรอบ', 'ตำป่าใส่หมูกรอบ มะเขือพวง', 55, 'ส้มตำ'],
  ['ไก่ย่างขุนอ้อ', 'ไก่ย่างนุ่ม หมักสูตรขอนแก่น', 70, 'ไก่ทอด'],
  ['ข้าวเหนียวนึ่ง', 'ข้าวเหนียวนึ่งร้อน ๆ หอม', 10, 'ข้าว'],
  ['ปลาดิบกาฬสินธุ์', 'ปลาดิบสูตรถิ่น สดใหม่ทุกเช้า', 120, 'อาหารอีสาน'],
  ['แกงอ่อมหมู', 'แกงอ่อมรสชาติจัดจ้าน ใส่เครื่องเทศครบ', 65, 'อาหารอีสาน'],
  ['ยำวุ้นเส้นทะเล', 'ยำวุ้นเส้นทะเลรสแซ่บ', 45, 'อาหารอีสาน'],
  ['ชานมไข่มุกไข่เค็ม', 'ชานมเย็น ไข่มุกเคี้ยวมัน', 35, 'เครื่องดื่ม'],
];

async function main() {
  const ins = { reasons: 0, menus: 0, restaurants: 0, owners: 0, hours: 0, wallet: 0 };
  const skip = { reasons: 0, menus: 0, restaurants: 0, wallet: 0 };

  // ---------- 1) เหตุผลยกเลิก 9 เหตุผล ----------
  const existingReasons = await get('cancellation_reasons', { select: 'label', limit: '100' });
  const reasonSet = new Set(existingReasons.map((r) => r.label));
  for (let i = 0; i < CANCEL_REASONS.length; i++) {
    const label = CANCEL_REASONS[i];
    if (reasonSet.has(label)) { skip.reasons++; continue; }
    await req('cancellation_reasons', {}, 'POST', {
      id: uuid(), label, is_active: true, sort_order: i + 1, created_at: now(), updated_at: now(),
    });
    ins.reasons++;
    console.log(`  + cancellation_reasons: ${label}`);
  }

  // ---------- หมวดอาหาร (global) สำหรับจับคู่เมนู ----------
  const cats = await get('categories', { select: 'id,name', limit: '200' });
  const catByName = new Map(cats.map((c) => [c.name, c.id]));
  const catOf = (name) => catByName.get(name) ?? [...catByName.values()][0];
  const restCats = await get('categories', { select: 'id,name', limit: '200' });

  // ---------- 2) ร้านใหม่ กาฬสินธุ์ + ขอนแก่น ----------
  const existingRests = await get('restaurants', { select: 'id,slug,name', limit: '500' });
  const restBySlug = new Map(existingRests.map((r) => [r.slug, r]));
  for (const spec of NEW_RESTAURANTS) {
    if (restBySlug.has(spec.slug)) { skip.restaurants++; continue; }
    // เจ้าของร้าน
    const email = `owner-${spec.slug}@foodthunder.co.th`;
    const dupe = await get('users', { email: `eq.${email}`, select: 'id', limit: '1' });
    let ownerId = dupe[0]?.id;
    if (!ownerId) {
      const [u] = await req('users', {}, 'POST', {
        id: uuid(), email, phone: `0910${String(200000 + Math.floor(Math.random() * 99999)).slice(-6)}`,
        full_name: `เจ้าของร้าน ${spec.name}`, role: 'restaurant',
        password_hash: bcrypt.hashSync('Food@1234', 12), is_active: true,
        failed_login_count: 0, phone_verified_at: now(), created_at: now(), updated_at: now(),
      });
      ownerId = u.id;
      ins.owners++;
    }
    // ร้าน
    const [rest] = await req('restaurants', {}, 'POST', {
      id: uuid(), name: spec.name, slug: spec.slug, description: spec.desc,
      location: `SRID=4326;POINT(${spec.lng} ${spec.lat})`,
      address_line: spec.address, city: spec.city, district: spec.district,
      phone: spec.phone, cuisine_types: ['อีสาน'], price_range: '$$',
      rating: 4.5, total_reviews: 0, is_open: true, is_active: true,
      prep_time_avg_minutes: 20, min_order_amount: 50,
      approval_status: 'approved', approved_at: now(), onboarding_state: {},
      created_at: now(), updated_at: now(),
    });
    ins.restaurants++;
    console.log(`  + restaurants: ${spec.name} (${spec.city})`);
    // โปรไฟล์เจ้าของ
    await req('restaurant_profiles', {}, 'POST', {
      id: uuid(), user_id: ownerId, restaurant_id: rest.id, staff_role: 'owner',
      permissions: { manage_menu: true, manage_orders: true, view_sales: true, manage_promotions: true },
      is_active: true, joined_at: now(), onboarding_completed_at: now(),
    });
    // เวลาเปิด 7 วัน
    const hourRows = [];
    for (let d = 0; d < 7; d++) {
      hourRows.push({ id: uuid(), restaurant_id: rest.id, day_of_week: d, open_time: '09:00', close_time: '21:00', is_closed: false });
    }
    await req('restaurant_opening_hours', {}, 'POST', hourRows);
    ins.hours += 7;
    // เมนู 8 รายการ
    for (let i = 0; i < ISAN_MENU.length; i++) {
      const [name, desc, baht, cat] = ISAN_MENU[i];
      await req('menu_items', {}, 'POST', {
        id: uuid(), restaurant_id: rest.id, category_id: catOf(cat),
        name, description: desc, base_price: baht * 100,
        is_available: true, is_popular: i < 2, sort_order: i + 1,
        updated_at: now(),
      });
      ins.menus++;
    }
    console.log(`  + เมนู 8 รายการ สำหรับ ${spec.name}`);
  }

  // ---------- 3) เมนูครบ 8 ต่อร้าน ----------
  const allRests = await get('restaurants', { select: 'id,name', limit: '500' });
  for (const rest of allRests) {
    const items = await get('menu_items', { restaurant_id: `eq.${rest.id}`, select: 'name', limit: '100' });
    const have = new Set(items.map((i) => i.name));
    let need = 8 - items.length;
    if (need <= 0) { continue; }
    for (const [name, desc, baht, cat] of MENU_POOL) {
      if (need <= 0) break;
      if (have.has(name)) continue;
      await req('menu_items', {}, 'POST', {
        id: uuid(), restaurant_id: rest.id, category_id: catOf(cat),
        name, description: desc, base_price: baht * 100,
        is_available: true, is_popular: false, sort_order: items.length + (8 - need) + 1,
        updated_at: now(),
      });
      have.add(name);
      need--;
      ins.menus++;
    }
    console.log(`  + เติมเมนู ${rest.name}: เหลือขาด ${Math.max(0, need)} รายการ`);
  }

  // ---------- 4) ธุรกรรมกระเป๋าเงินตัวอย่าง (ย้อนหลายวัน) ----------
  const customers = await get('users', { role: 'eq.customer', is_active: 'eq.true', select: 'id,full_name', limit: '8' });
  const SAMPLES = [7, 3, 1]; // จำนวนวันย้อนหลัง
  for (const cust of customers) {
    const dup = await get(
      'wallet_transactions',
      `user_id=eq.${cust.id}&reason=eq.${encodeURIComponent('เติมเงิน (ข้อมูลตัวอย่าง)')}&select=id&limit=1`,
    );
    if (dup.length) { skip.wallet++; continue; }
    const amounts = [50000, 30000, 20000]; // สตางค์: ฿500 / ฿300 / ฿200
    for (let i = 0; i < SAMPLES.length; i++) {
      await req('wallet_transactions', {}, 'POST', {
        id: uuid(), user_id: cust.id,
        amount_delta: amounts[i], type: 'credit', status: 'completed',
        reason: 'เติมเงิน (ข้อมูลตัวอย่าง)', ref_id: null,
        created_at: daysAgoIso(SAMPLES[i]),
      });
      ins.wallet++;
    }
    console.log(`  + wallet_transactions 3 รายการ ของ ${cust.full_name ?? cust.id}`);
  }

  // ---------- สรุป + ตรวจสอบย้อนหลัง ----------
  console.log(`\nเหตุผลยกเลิก   เพิ่ม ${ins.reasons} | ข้าม ${skip.reasons}`);
  console.log(`ร้านใหม่       เพิ่ม ${ins.restaurants} | ข้าม ${skip.restaurants} (เจ้าของ ${ins.owners} เวลาเปิด ${ins.hours} แถว)`);
  console.log(`เมนู           เพิ่ม ${ins.menus}`);
  console.log(`กระเป๋าเงิน    เพิ่ม ${ins.wallet} | ข้าม ${skip.wallet}`);
  const [nReasons, nRests, nMenus, nWallet] = await Promise.all([
    get('cancellation_reasons', { select: 'id', limit: '1' }).then(() => existingReasons.length + ins.reasons),
    get('restaurants', { select: 'id', limit: '1' }).then(() => existingRests.length + ins.restaurants),
    null, null,
  ]);
  const menusAfter = (await get('menu_items', { select: 'id', limit: '1000' })).length;
  console.log(`ตรวจสอบ: เหตุผล ${nReasons} | ร้าน ${nRests} | เมนู ${menusAfter} รายการ`);
  const under8 = [];
  for (const rest of await get('restaurants', { select: 'id,name', limit: '500' })) {
    const n = (await get('menu_items', { restaurant_id: `eq.${rest.id}`, select: 'id', limit: '100' })).length;
    if (n < 8) under8.push(`${rest.name}=${n}`);
  }
  console.log(under8.length ? `⚠ ร้านที่ยังต่ำกว่า 8 เมนู: ${under8.join(', ')}` : '✓ ทุกร้านมีเมนูครบ 8 รายการขึ้นไป');
}

main().catch((e) => { console.error(e); process.exit(1); });
