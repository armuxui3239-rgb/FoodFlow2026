// ============================================================
// FoodFlow2026 — P0 data completeness fix (2026-11-09 audit)
// แก้ข้อมูลตั้งต้น 8 จุดตามผลตรวจฐานข้อมูลจริง:
//  P0-1 พิกัด 8 ร้านที่อยู่เวียดนาม → กรุงเทพฯ ตามที่อยู่จริง
//  P0-2 เวลาเปิด-ปิดร้านที่ยังขาด (7 วัน/ร้าน)
//  P0-3 เติมเมนูหมวด "ของทานเล่น" + "เครื่องดื่ม" ทุกร้าน
//  P0-4 ออเดอร์เดินจบวงจรครบทุกสถานะ + ไรเดอร์ออนไลน์มีพิกัด
//  P0-5 preferred_locale = 'th' ทุกบัญชี + อีเมล @foodflow.vn → @foodthunder.co.th
//  P0-7 ตัวเลือกเมนู (ขนาด/เพิ่มพิเศษ) + ค่าราคาเพิ่ม
//  P0-8 บัญชีเจ้าของร้านสำหรับร้านที่ยังไม่มี + restaurant_profiles
// รัน: node scripts/fix-p0-data.mjs   (ต้องมี env SBK หรือแก้ KEY ด้านล่าง)
// ============================================================
import bcrypt from 'bcryptjs';

const URL = 'https://lgjwrxrhbksdbzorcwwb.supabase.co/rest/v1';
const KEY = process.env.SBK;
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function req(t, q, method, body) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const url = `${URL}/${t}${q ? `?${new URLSearchParams(q)}` : ''}`;
    const r = await fetch(url, {
      method: method ?? 'GET',
      headers: method && body ? { ...H, Prefer: 'return=representation' } : H,
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await r.text();
    if (r.ok) { await sleep(80); return text ? JSON.parse(text) : []; }
    console.error(`! ${r.status} ${t} (ครั้งที่ ${attempt + 1}): ${text.slice(0, 160)}`);
    if (r.status === 401 || r.status === 403) process.exit(1);
    await sleep(1500 * (attempt + 1));
  }
  throw new Error(`ล้มเหลวถาวร: ${t}`);
}
const get = (t, q) => req(t, q);
const patch = (t, q, body) => req(t, q, 'PATCH', body);
const insert = (t, body) => req(t, '', 'POST', body);
const uuid = () => crypto.randomUUID();
const nowISO = () => new Date().toISOString();
const point = (lat, lng) => `SRID=4326;POINT(${lng} ${lat})`;
const minAgo = (m) => new Date(Date.now() - m * 60_000).toISOString();

// ─── P0-1 พิกัดร้านที่ผิดประเทศ (slug → พิกัดจริงใกล้ที่อยู่ในตาราง) ───
const CORRECT_COORDS = {
  'ft-1': [13.7426, 100.5112], // ข้าวมันไก่เจ๊กเป็น — ถ.เยาวราช สัมพันธวงศ์
  'ft-2': [13.7379, 100.5123], // ต้มยำกุ้ง 77 — ถ.เจริญกรุง บางรัก
  'ft-3': [13.7589, 100.5017], // ผัดไทยทิพย์สมบัติ — ซ.ประดับพณิชยการ ดินสอ
  'ft-4': [13.7513, 100.5289], // ส้มตำนักเดินทาง — ถ.พระราม 4 วังใหม่
  'ft-5': [13.7747, 100.5543], // พิซซ่า รัชดา 32 — ถ.รัชดาภิเษก ดินแดง
  'ft-6': [13.6937, 100.5259], // ซูชิเค ยานนาวา — ถ.พระราม 3 ช่องนนทรี
  'ft-7': [13.7566, 100.5621], // ไก่ทอดหาดใหญ่ — ถ.เพชรบุรีตัดใหม่ มักกะสัน
  'ft-8': [13.8009, 100.5150], // ก๋วยเตี๋ยวเรือนอยุธยา — สาขากรุงเทพฯ
};

// ─── เวลาเปิด-ปิดตามประเภทร้าน (P0-2) ───
const HOURS_DEFAULT = { open: '09:00', close: '21:00' };
const HOURS_BY_SLUG = {
  'ft-10': { open: '16:00', close: '23:00' }, // สุกี้
  'ft-12': { open: '06:00', close: '14:00' }, // โจ๊ก
  'ft-16': { open: '11:00', close: '22:00' }, // ทะเล
  'ft-19': { open: '10:00', close: '21:00' }, // ชานม
  'ft-20': { open: '07:00', close: '19:00', closedDays: [1] }, // เบเกอรี่ ปิดจันทร์
  'ft-22': { open: '11:00', close: '20:00' }, // ไอศกรีม
};

// ─── เมนูเติมหมวดว่าง (P0-3) — คลังรายการ ───
const CATALOG = {
  หมูปิ้ง: { d: 'หมูหมักสูตรโบราณเสียบไม้ ย่างไฟอ่อนหอมนุ่ม ทานคู่ข้าวเหนียวร้อน ๆ', p: 25, img: 'moopin' },
  ทอดมันปลา: { d: 'ทอดมันปลากรายเนื้อฟู หอมกะปิ จิ้มน้ำพริกอาจาดแบบต้นตำรับ', p: 45, img: 'todmun' },
  ทอดมันกุ้ง: { d: 'ทอดมันกุ้งชิ้นใหญ่ เนื้อกุ้งแน่น กรอบนอกนุ่มใน', p: 55, img: 'todmun' },
  ปอเปี๊ยะทอด: { d: 'ปอเปี๊ยะทอดกรอบ ไส้ผักสดราดซอสหวานเปรี้ยว', p: 40, img: 'spring' },
  ขนมครก: { d: 'ขนมครกกระทะเก่า แป้งข้าวหอมมะลิ หน้ากุ้งสดและหน้ามันปลา', p: 30, img: 'kanomkrok' },
  เฟรนช์ฟราย: { d: 'มันฝรั่งทอดเส้นใหญ่กรอบนอกร้อนฉ่ำ พร้อมซอสมะเขือเทศ', p: 45, img: 'fries' },
  ปีกไก่ทอด: { d: 'ปีกไก่หมักเครื่องเทศ ทอดกรอบราดซอสหวานเผ็ด', p: 69, img: 'chickenwing' },
  นักเก็ตไก่ทอด: { d: 'นักเก็ตไก่ชิ้นพอคำ กรอบนอกนุ่มใน กินเพลินไม่หยุด', p: 59, img: 'chickenwing' },
  เกี๊ยวซ่าทอด: { d: 'เกี๊ยวซ่ากรอบนอก ไส้หมูฉ่ำ จิ้มซอสน้ำส้ม', p: 60, img: 'spring' },
  หอยทอด: { d: 'แป้งหอยทอดกรอบหอยนางรมสดใหญ่ จิ้มซอสส้มฉี', p: 70, img: 'todmun' },
  ชาไทย: { d: 'ชาเย็นโบราณ เข้มข้น หวานมัน กำลังดี', p: 25, img: 'chathai' },
  กาแฟโบราณ: { d: 'กาแฟโอเลี้ยงสูตรโบราณ หอมข้น เย็นสดชื่น', p: 30, img: 'coffee' },
  น้ำมะนาว: { d: 'น้ำมะนาวสายน้ำผึ้งคั้นสด เปรี้ยวสดชื่น', p: 25, img: 'lime' },
  โกโก้เย็น: { d: 'โกโก้เย็นข้นครีม หอมกลิ่นโกโก้แท้', p: 35, img: 'choco' },
  น้ำมะพร้าว: { d: 'มะพร้าวน้ำหอมทั้งลูก เย็นฉ่ำธรรมชาติ', p: 40, img: 'coconut' },
  โซดามะนาว: { d: 'โซดามะนาวพร้อมน้ำแข็ง สดชื่นกรอบรด', p: 25, img: 'sodafloat' },
  ชานมไข่มุก: { d: 'ชานมไข่มุกเหนียวนุ่ม ชาเข้มข้น นมสด', p: 45, img: 'bubbletea' },
  ชาเขียวเย็น: { d: 'ชาเขียวมัทฉะเย็น หอมเข้มข้น กลมกล่อม', p: 40, img: 'chathai' },
};
const IMG = {
  moopin: 'https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/265b607485a0.jpg',
  todmun: 'https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/3d18f30ea76f.jpg',
  spring: 'https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/f571b306316c.jpeg',
  kanomkrok: 'https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/22da1b2fd0b0.jpeg',
  fries: 'https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/70b099a7cd4b.jpg',
  chickenwing: 'https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/52cbf6e009b5.jpg',
  chathai: 'https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/77a53d0528b2.jpg',
  coffee: 'https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/0dbc91311dd9.jpg',
  lime: 'https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/b9449a458fb4.jpg',
  choco: 'https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/6483853f19b9.jpg',
  coconut: 'https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/7fda9f1ab4a7.png',
  sodafloat: 'https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/fb4fb714ceb4.png',
  bubbletea: 'https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/8b6a12a34ffb.png',
};
// slug → [ชื่อทานเล่น 2, ชื่อเครื่องดื่ม 2]
const MENU_ADD = {
  'ft-1': [['หมูปิ้ง', 'ทอดมันปลา'], ['ชาไทย', 'กาแฟโบราณ']],
  'ft-2': [['ทอดมันกุ้ง', 'ปอเปี๊ยะทอด'], ['น้ำมะนาว', 'ชาไทย']],
  'ft-3': [['ขนมครก', 'ปอเปี๊ยะทอด'], ['ชาไทย', 'โกโก้เย็น']],
  'ft-4': [['หมูปิ้ง', 'ขนมครก'], ['น้ำมะพร้าว', 'กาแฟโบราณ']],
  'ft-5': [['เฟรนช์ฟราย', 'นักเก็ตไก่ทอด'], ['โซดามะนาว', 'น้ำมะนาว']],
  'ft-6': [['เกี๊ยวซ่าทอด', 'ทอดมันกุ้ง'], ['ชาเขียวเย็น', 'โกโก้เย็น']],
  'ft-7': [['เฟรนช์ฟราย', 'ปีกไก่ทอด'], ['โซดามะนาว', 'ชาไทย']],
  'ft-8': [['ทอดมันปลา', 'ปอเปี๊ยะทอด'], ['โซดามะนาว', 'น้ำมะนาว']],
  'ft-9': [['หมูปิ้ง', 'ทอดมันปลา'], ['ชาไทย', 'โกโก้เย็น']],
  'ft-10': [['ปอเปี๊ยะทอด', 'ทอดมันกุ้ง'], ['ชาไทย', 'โกโก้เย็น']],
  'ft-11': [['ขนมครก', 'หมูปิ้ง'], ['น้ำมะพร้าว', 'ชาไทย']],
  'ft-12': [['หมูปิ้ง', 'ขนมครก'], ['กาแฟโบราณ', 'ชาไทย']],
  'ft-13': [['ทอดมันปลา', 'ปอเปี๊ยะทอด'], ['น้ำมะนาว', 'ชาไทย']],
  'ft-14': [['หมูปิ้ง', 'ทอดมันปลา'], ['ชาไทย', 'โกโก้เย็น']],
  'ft-15': [['ปอเปี๊ยะทอด', 'ขนมครก'], ['กาแฟโบราณ', 'ชาไทย']],
  'ft-16': [['หอยทอด', 'ปอเปี๊ยะทอด'], ['น้ำมะพร้าว', 'น้ำมะนาว']],
  'ft-17': [['หมูปิ้ง', 'ขนมครก'], ['ชาไทย', 'น้ำมะนาว']],
  'ft-18': [['หมูปิ้ง', 'ทอดมันปลา'], ['โกโก้เย็น', 'ชาไทย']],
  'ft-19': [['ขนมครก', 'ปอเปี๊ยะทอด'], ['ชานมไข่มุก', 'โกโก้เย็น']],
  'ft-20': [['ปอเปี๊ยะทอด', 'ขนมครก'], ['กาแฟโบราณ', 'ชานมไข่มุก']],
  'ft-21': [['หอยทอด', 'ขนมครก'], ['น้ำมะพร้าว', 'ชาไทย']],
  'ft-22': [['ขนมครก', 'ปอเปี๊ยะทอด'], ['น้ำมะพร้าว', 'โกโก้เย็น']],
};

// ─── วงจรออเดอร์ (P0-4) ───
const FULL_CHAIN = [
  ['created', 0], ['pending_payment', 2], ['paid', 3], ['restaurant_pending', 5],
  ['restaurant_accepted', 18], ['preparing', 20], ['ready_for_pickup', 45],
  ['driver_assigned', 50], ['driver_arriving_restaurant', 52], ['picked_up', 58],
  ['delivering', 62], ['delivered', 85], ['completed', 90],
];
const TARGETS = ['restaurant_accepted', 'preparing', 'ready_for_pickup', 'driver_assigned',
  'driver_arriving_restaurant', 'picked_up', 'delivering', 'delivered', 'completed'];
const TASK_STATUS = {
  driver_assigned: 'assigned', driver_arriving_restaurant: 'heading_to_restaurant',
  picked_up: 'heading_to_customer', delivering: 'heading_to_customer',
  delivered: 'delivered', completed: 'delivered',
};

async function main() {
  console.log('▒▒ โหลดข้อมูลร้าน/ผู้ใช้ทั้งหมด ▒▒');
  const rests = await get('restaurants', 'select=id,name,slug,location,address_line,city,district,is_active,approval_status,cuisine_types,price_range,prep_time_avg_minutes,min_order_amount,rating,total_reviews,is_open&order=slug.asc');
  const users = await get('users', 'select=id,email,phone,full_name,role,preferred_locale,password_hash,is_active,failed_login_count');
  const rprofs = await get('restaurant_profiles', 'select=id,user_id,restaurant_id,staff_role');

  // ════ P0-1 พิกัด ════
  console.log('\n▒▒ P0-1: แก้พิกัด 8 ร้านเวียดนาม → กรุงเทพฯ ▒▒');
  for (const r of rests) {
    const c = CORRECT_COORDS[r.slug];
    if (!c) continue;
    await patch('restaurants', { id: `eq.${r.id}` }, { location: point(c[0], c[1]) });
    console.log(`  ✓ ${r.slug} ${r.name} → ${c[0]}, ${c[1]}`);
  }

  // ════ P0-2 เวลาเปิด-ปิด ════
  console.log('\n▒▒ P0-2: เวลาเปิด-ปิดร้านที่ยังขาด ▒▒');
  const hours = await get('restaurant_opening_hours', 'select=restaurant_id,day_of_week');
  const restsWithHours = new Set(hours.map((h) => h.restaurant_id));
  const needHours = rests.filter((r) => !restsWithHours.has(r.id));
  for (const r of needHours) {
    const cfg = HOURS_BY_SLUG[r.slug] ?? HOURS_DEFAULT;
    const rows = [];
    for (let d = 0; d < 7; d++) {
      rows.push({
        id: uuid(), restaurant_id: r.id, day_of_week: d,
        open_time: cfg.open, close_time: cfg.close,
        is_closed: (cfg.closedDays ?? []).includes(d),
      });
    }
    await insert('restaurant_opening_hours', rows);
    console.log(`  ✓ ${r.slug} ${r.name}: 7 วัน (${cfg.open}-${cfg.close}${cfg.closedDays ? ' ปิดวันจันทร์' : ''})`);
  }
  console.log(`  ร้านที่เติม: ${needHours.length} ร้าน (+${needHours.length * 7} แถว)`);

  // ════ P0-5 locale + อีเมล ════
  console.log('\n▒▒ P0-5: locale=th ทุกบัญชี + อีเมล foodflow.vn → foodthunder.co.th ▒▒');
  let localeFixed = 0, emailFixed = 0, localeNeedsDDL = 0;
  for (const u of users) {
    // locale: enum LocaleCode ของเทมเพลตอาจยังไม่มีค่า 'th' — ลองก่อน ถ้า enum ไม่รับให้ข้ามและนับไว้
    if (u.preferred_locale !== 'th') {
      try {
        await patch('users', { id: `eq.${u.id}` }, { preferred_locale: 'th' });
        localeFixed++;
      } catch {
        localeNeedsDDL++;
      }
    }
    if (u.email.endsWith('@foodflow.vn')) {
      await patch('users', { id: `eq.${u.id}` }, { email: u.email.replace('@foodflow.vn', '@foodthunder.co.th') });
      emailFixed++;
    }
  }
  console.log(`  ✓ แก้ locale: ${localeFixed} บัญชี | เปลี่ยนอีเมล: ${emailFixed} บัญชี`);
  if (localeNeedsDDL > 0) {
    console.log(`  ⚠ locale: ${localeNeedsDDL} บัญชีรอ DDL — enum LocaleCode ยังไม่มีค่า 'th' (ต้องรัน deployments/sql/add_th_locale.sql ใน Supabase SQL Editor)`);
  }

  // ════ P0-8 เจ้าของร้าน ════
  console.log('\n▒▒ P0-8: บัญชีเจ้าของร้านสำหรับร้านที่ยังไม่มี ▒▒');
  const profiledRests = new Set(rprofs.map((p) => p.restaurant_id));
  const unowned = rests.filter((r) => !profiledRests.has(r.id));
  const pwHash = bcrypt.hashSync('Food@1234', 10);
  let ownerN = 0;
  for (const r of unowned) {
    ownerN++;
    const email = `owner-${r.slug}@foodthunder.co.th`;
    const phone = `0910${String(100000 + ownerN).slice(-6)}`;
    const [u] = await insert('users', {
      id: uuid(), email, phone, full_name: `เจ้าของร้าน ${r.name}`,
      role: 'restaurant', password_hash: pwHash, is_active: true,
      failed_login_count: 0, preferred_locale: 'th',
      phone_verified_at: nowISO(), created_at: nowISO(), updated_at: nowISO(),
    });
    await insert('restaurant_profiles', {
      id: uuid(), user_id: u.id, restaurant_id: r.id, staff_role: 'owner',
      permissions: { manage_menu: true, manage_orders: true, view_sales: true, manage_promotions: true },
      is_active: true, joined_at: nowISO(), onboarding_completed_at: nowISO(),
    });
    console.log(`  ✓ ${r.slug} ${r.name} → ${email} (รหัสผ่านเริ่มต้น Food@1234)`);
  }
  console.log(`  สร้างเจ้าของใหม่: ${unowned.length} บัญชี`);

  // ════ P0-3 เมนูเติมหมวด ════
  console.log('\n▒▒ P0-3: เติมเมนูหมวด "ของทานเล่น"/"เครื่องดื่ม" ทุกร้าน ▒▒');
  const cats = await get('categories', 'select=id,restaurant_id,name,sort_order&order=restaurant_id.asc,sort_order.asc');
  const items = await get('menu_items', 'select=id,restaurant_id,category_id,name,sort_order');
  let added = 0;
  for (const r of rests) {
    const spec = MENU_ADD[r.slug];
    if (!spec) continue;
    const rCats = cats.filter((c) => c.restaurant_id === r.id);
    const snackCat = rCats.find((c) => c.name.includes('ทานเล่น'));
    const drinkCat = rCats.find((c) => c.name.includes('เครื่องดื่ม'));
    if (!snackCat || !drinkCat) { console.log(`  ! ${r.slug} หาหมวดไม่เจอ ข้าม`); continue; }
    const rItems = items.filter((i) => i.restaurant_id === r.id);
    const existingNames = new Set(rItems.map((i) => i.name));
    let maxSort = Math.max(-1, ...rItems.map((i) => i.sort_order ?? -1));
    for (const name of [...spec[0], ...spec[1]]) {
      if (existingNames.has(name)) continue;
      const c = CATALOG[name];
      if (!c) { console.log(`  ! ไม่รู้จักเมนู ${name}`); continue; }
      const isDrink = ['ชา', 'กาแฟ', 'น้ำ', 'โกโก้', 'โซดา'].some((k) => name.includes(k));
      maxSort++;
      await insert('menu_items', {
        id: uuid(), restaurant_id: r.id,
        category_id: isDrink ? drinkCat.id : snackCat.id,
        name, description: c.d, image_url: IMG[c.img], base_price: c.p,
        is_available: true, is_popular: false, sort_order: maxSort,
        created_at: nowISO(), updated_at: nowISO(),
      });
      existingNames.add(name);
      added++;
    }
  }
  console.log(`  ✓ เพิ่มเมนูใหม่: ${added} รายการ`);

  // ════ P0-7 ตัวเลือกเมนู ════
  console.log('\n▒▒ P0-7: ตัวเลือกเมนู (ขนาด/เพิ่มพิเศษ) ▒▒');
  const firstItems = {};
  for (const it of items) {
    if (!firstItems[it.restaurant_id]) firstItems[it.restaurant_id] = [];
    firstItems[it.restaurant_id].push(it);
  }
  const existingOptions = await get('menu_item_options', 'select=menu_item_id');
  const hasOption = new Set(existingOptions.map((o) => o.menu_item_id));
  let optN = 0, valN = 0;
  for (const r of rests) {
    const its = (firstItems[r.id] ?? []).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)).slice(0, 2);
    for (const it of its) {
      if (hasOption.has(it.id)) continue;
      const [sizeOpt] = await insert('menu_item_options', {
        id: uuid(), menu_item_id: it.id, name: 'ขนาดพิเศษ',
        is_required: true, is_multiple: false, created_at: nowISO(),
      });
      await insert('menu_item_option_values', [
        { id: uuid(), option_id: sizeOpt.id, value: 'ธรรมดา', price_modifier: 0 },
        { id: uuid(), option_id: sizeOpt.id, value: 'พิเศษ (เพิ่มส่วนพร้อม)', price_modifier: 2500 },
      ]);
      const [extraOpt] = await insert('menu_item_options', {
        id: uuid(), menu_item_id: it.id, name: 'เพิ่มเครื่องเคียง',
        is_required: false, is_multiple: true, created_at: nowISO(),
      });
      await insert('menu_item_option_values', [
        { id: uuid(), option_id: extraOpt.id, value: 'ไข่ดองเพิ่ม', price_modifier: 1000 },
        { id: uuid(), option_id: extraOpt.id, value: 'ข้าวเพิ่ม', price_modifier: 1000 },
        { id: uuid(), option_id: extraOpt.id, value: 'ผักราดเพิ่ม', price_modifier: 500 },
      ]);
      hasOption.add(it.id);
      optN += 2; valN += 5;
    }
  }
  console.log(`  ✓ กลุ่มตัวเลือก: ${optN} | ค่าตัวเลือก: ${valN}`);

  // ════ P0-4 ออเดอร์จบวงจร + ไรเดอร์ ════
  console.log('\n▒▒ P0-4: ออเดอร์วงจรสมบูรณ์ + ไรเดอร์ออนไลน์มีพิกัด ▒▒');
  // 4a. ไรเดอร์ออนไลน์ + พิกัด
  const drivers = await get('driver_profiles', 'select=id,user_id,rating');
  const driverCoords = [[13.7452, 100.5312], [13.7528, 100.5401], [13.7601, 100.5487], [13.7388, 100.5515], [13.7664, 100.5233]];
  for (let i = 0; i < drivers.length; i++) {
    const c = driverCoords[i % driverCoords.length];
    await patch('driver_profiles', { id: `eq.${drivers[i].id}` }, { is_online: true, current_lat: c[0], current_lng: c[1] });
  }
  console.log(`  ✓ ไรเดอร์ออนไลน์ + พิกัด: ${drivers.length} คน`);

  // 4b. ลูกค้าต้องมีที่อยู่ + profile
  const customers = users.filter((u) => u.role === 'customer');
  const cprofs = await get('customer_profiles', 'select=id,user_id,default_address_id');
  const addrs = await get('addresses', 'select=id,user_id,is_default,address_line');
  const addrByUser = {};
  addrs.forEach((a) => { (addrByUser[a.user_id] ||= []).push(a); });
  const profByUser = {};
  cprofs.forEach((p) => { profByUser[p.user_id] = p; });
  const readyCustomers = [];
  for (const c of customers) {
    if (!addrByUser[c.id]) {
      const [a] = await insert('addresses', {
        id: uuid(), user_id: c.id, label: 'บ้าน',
        address_line: '99 ถนนสุขุมวิท แขวงคลองเตย เขตคลองเตย กรุงเทพมหานคร',
        location: point(13.7292, 100.5420), is_default: true, created_at: nowISO(),
      });
      (addrByUser[c.id] ||= []).push(a);
    }
    if (!profByUser[c.id]) {
      const [p] = await insert('customer_profiles', {
        id: uuid(), user_id: c.id, default_address_id: null,
        saved_payment_methods: [], preferences: {}, total_orders: 0,
      });
      profByUser[c.id] = p;
    }
    const prof = profByUser[c.id];
    if (!prof.default_address_id) {
      const def = (addrByUser[c.id] ?? []).find((a) => a.is_default) ?? (addrByUser[c.id] ?? [])[0];
      if (def) await patch('customer_profiles', { id: `eq.${prof.id}` }, { default_address_id: def.id });
    }
    const def = (addrByUser[c.id] ?? []).find((a) => a.is_default) ?? (addrByUser[c.id] ?? [])[0];
    if (def) readyCustomers.push({ user: c, addr: def });
  }
  console.log(`  ✓ ลูกค้าพร้อมใช้ (มีที่อยู่): ${readyCustomers.length}`);

  // 4c. สร้าง 9 ออเดอร์ ครอบคลุมทุกสถานะระหว่างทาง (กันซ้ำ: ข้ามถ้าโค้ดนี้มีแล้ว)
  const existingCodes = new Set((await get('orders', 'select=order_code&order_code=in.(' + TARGETS.map((_, i) => `FT2611${String(100 + i).slice(-3)}${['A','B','C','D','E','F','G','H','J'][i]}`).join(',') + ')')).map((o) => o.order_code));
  const createdAt = new Date();
  const newOrders = [];
  for (let i = 0; i < TARGETS.length; i++) {
    const target = TARGETS[i];
    const code = `FT2611${String(100 + i).slice(-3)}${['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'J'][i]}`;
    if (existingCodes.has(code)) { console.log(`  ↷ ข้าม ${code} (มีอยู่แล้ว)`); continue; }
    const rest = rests[i % rests.length];
    const cust = readyCustomers[i % readyCustomers.length];
    const rItems = (firstItems[rest.id] ?? []).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)).slice(0, 3);
    if (rItems.length === 0) { console.log(`  ! ร้าน ${rest.slug} ไม่มีเมนู ข้าม`); continue; }
    const picks = rItems.map((it, k) => ({ it, qty: (k === 0 ? 2 : 1) }));
    const subtotal = picks.reduce((s, p) => s + Number(p.it.base_price ?? 0) * p.qty, 0);
    const deliveryFee = 3500;
    const total = subtotal + deliveryFee;
    const chain = FULL_CHAIN.filter(([st]) => {
      const idx = FULL_CHAIN.findIndex(([s2]) => s2 === st);
      const tIdx = FULL_CHAIN.findIndex(([s2]) => s2 === target);
      return idx <= tIdx;
    });
    const lastOffset = chain[chain.length - 1][1];
    const createdAtTs = minAgo(lastOffset);
    const needsDriver = ['driver_assigned', 'driver_arriving_restaurant', 'picked_up', 'delivering', 'delivered', 'completed'].includes(target);
    const driver = needsDriver ? drivers[i % drivers.length] : null;
    const base = {
      id: uuid(), order_code: code,
      customer_id: cust.user.id, restaurant_id: rest.id, driver_id: driver?.user_id ?? null,
      delivery_address_id: cust.addr.id, status: target,
      subtotal, delivery_fee: deliveryFee, promotion_discount: 0, total,
      payment_method: i % 3 === 0 ? 'cash' : 'promptpay',
      notes: null, estimated_prep_time_minutes: rest.prep_time_avg_minutes ?? 20,
      estimated_delivery_time_minutes: 30,
      actual_delivery_time_minutes: ['delivered', 'completed'].includes(target) ? 28 + (i % 6) : null,
      commission_rate_at_order_time: 15,
      created_at: createdAtTs, updated_at: minAgo(lastOffset),
    };
    const [order] = await insert('orders', base);
    // order_items
    for (const p of picks) {
      await insert('order_items', {
        id: uuid(), order_id: order.id, menu_item_id: p.it.id,
        name_snapshot: p.it.name, quantity: p.qty, unit_price: Number(p.it.base_price),
        selected_options: [], notes: null,
      });
    }
    // payment (ทุกออเดอร์ชุดนี้จ่ายแล้ว ตั้งแต่ paid ขึ้นไป)
    const paidOffset = chain.find(([s]) => s === 'paid')?.[1];
    if (paidOffset !== undefined) {
      await insert('payments', {
        id: uuid(), order_id: order.id, amount: total,
        method: base.payment_method, status: 'completed',
        transaction_id: uuid(), paid_at: minAgo(paidOffset), created_at: minAgo(paidOffset),
      });
    }
    // history
    for (const [st, off] of chain) {
      await insert('order_status_history', {
        id: uuid(), order_id: order.id, status: st, changed_by: 'seed',
        note: 'ข้อมูลตัวอย่าง: วงจรคำสั่งซื้อสมบูรณ์', created_at: minAgo(off),
      });
    }
    // delivery task
    if (driver) {
      const asgOffset = chain.find(([s]) => s === 'driver_assigned')?.[1];
      const pkoOffset = chain.find(([s]) => s === 'picked_up')?.[1];
      const delOffset = chain.find(([s]) => s === 'delivered')?.[1];
      const rp = CORRECT_COORDS[rest.slug] ?? [13.7400 + 0.002 * (i % 22), 100.5150 + 0.002 * (i % 18)];
      await insert('delivery_tasks', {
        id: uuid(), order_id: order.id, driver_id: driver.user_id,
        pickupLocation: point(rp[0], rp[1]),
        dropoffLocation: point(13.7292, 100.5420),
        status: TASK_STATUS[target],
        pickup_distance_km: 0.8 + (i % 5) * 0.4, delivery_distance_km: 1.5 + (i % 7) * 0.5,
        assigned_at: minAgo(asgOffset ?? 10),
        picked_up_at: pkoOffset !== undefined ? minAgo(pkoOffset) : null,
        delivered_at: delOffset !== undefined ? minAgo(delOffset) : null,
      });
    }
    // รีวิว + แจ้งเตือน สำหรับ completed
    if (target === 'completed') {
      await insert('reviews', {
        id: uuid(), order_id: order.id, customer_id: cust.user.id, restaurant_id: rest.id,
        driver_id: driver?.user_id ?? null, food_rating: 5, delivery_rating: 5,
        comment: 'อาหารถึงมือร้อน ๆ จัดส่งไวมาก ไรเดอร์สุภาพ จะกลับมาสั่งอีกแน่นอน',
        is_hidden: false, photos: [], created_at: minAgo(80),
      });
      await insert('notifications', {
        id: uuid(), user_id: cust.user.id, title: 'ส่งออเดอร์ถึงแล้ว',
        body: `ออเดอร์ ${order.order_code} จาก ${rest.name} ส่งถึงที่หมายเรียบร้อย ขอบคุณที่ใช้บริการ`,
        type: 'order', data: { order_id: order.id }, is_read: false, created_at: minAgo(85),
      });
    }
    newOrders.push(order);
    console.log(`  ✓ ${order.order_code} → ${target} (${rest.slug}, ฿${(total / 100).toFixed(0)})`);
  }

  console.log('\n═══ สรุปการแก้ไข ═══');
  console.log(`P0-1 พิกัด 8 ร้าน ✓ | P0-2 เวลาเปิด +${needHours.length * 7} แถว ✓ | P0-3 เมนู +${added} ✓`);
  console.log(`P0-4 ออเดอร์ +${newOrders.length} (ครบทุกสถานะ) ไรเดอร์ออนไลน์ ${drivers.length} คน ✓`);
  console.log(`P0-5 locale th +${localeFixed}, อีเมล ${emailFixed} ✓ | P0-7 ตัวเลือก ${optN}/${valN} ✓ | P0-8 เจ้าของ +${unowned.length} ✓`);
  console.log('เสร็จสมบูรณ์');
}

main().catch((e) => { console.error(e); process.exit(1); });
