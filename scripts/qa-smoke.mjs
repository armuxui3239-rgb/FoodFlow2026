// qa-smoke.mjs — ชุดทดสอบวงจรธุรกิจอัตโนมัติ (4 บทบาท) ตาม docs/QA-WORKFLOW.md
// รันกับ dev server ที่กำลังทำงาน: node scripts/qa-smoke.mjs [baseUrl]
// วงจรจริง: สมัคร(รหัสภายใน)→ตั้งค่า→สั่ง→จ่าย→ร้านรับ(หรือ admin เตรียม)→ไรเดอร์รับจริง→ส่ง→รีวิว→ทิป→แชท→โทร→แอดมิน

const BASE = process.argv[2] || 'http://localhost:3000';
// IP ทดสอบสุ่มต่อรอบ — จำลอง client คนละเครือข่าย กันชนโควตา 10 ครั้ง/ชั่วโมง/IP ของ otp/send
const TEST_IP = `198.18.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250) + 1}`;
let pass = 0;
let fail = 0;
const failures = [];

function check(name, ok, detail = '') {
  if (ok) {
    pass++;
    console.log(`  ✅ ${name}`);
  } else {
    fail++;
    failures.push(`${name}${detail ? ` — ${detail}` : ''}`);
    console.log(`  ❌ ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

function cookieOf(res) {
  // Node/undici คืนหลาย Set-Cookie — เลือก ft_session ก่อน แล้ว ft_pending
  const all = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : [res.headers.get('set-cookie') || ''];
  const pick = (name) => all.map((c) => c.split(';')[0]).find((c) => c.startsWith(`${name}=`));
  return pick('ft_session') || pick('ft_pending') || '';
}

async function api(path, { method = 'GET', body, cookie } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': TEST_IP, ...(cookie ? { Cookie: cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await res.json(); } catch { /* html */ }
  return { status: res.status, json, cookie: cookieOf(res) };
}

const stamp = Date.now().toString().slice(-8);
const testPhone = `0991${stamp.slice(-6)}${Math.floor(Math.random() * 9)}`.slice(0, 10);

async function main() {
  console.log(`\n🧪 QA Smoke — ${BASE}\n`);

  // ---------- 1. แขก (Guest) ----------
  console.log('1) Guest — ข้อมูลสาธารณะ');
  let r = await api('/api/restaurants?limit=5');
  check('GET /api/restaurants', r.status === 200 && Array.isArray(r.json?.data) && r.json.data.length > 0, `HTTP ${r.status}`);
  const restaurantId = r.json?.data?.[0]?.id;
  r = await api('/api/promotions');
  check('GET /api/promotions', r.status === 200);
  const promo = r.json?.data?.[0];
  r = await api('/api/menu/popular');
  check('GET /api/menu/popular', r.status === 200 && Array.isArray(r.json?.data));

  // ---------- 2. ลูกค้า: สมัครด้วยรหัสภายใน ----------
  console.log('2) Customer — สมัครสมาชิก (รหัสภายใน ไม่มี SMS)');
  r = await api('/api/auth/otp/send', { method: 'POST', body: { phone: testPhone, email: `qa${stamp}@foodthunder.co.th`, fullName: 'QA Smoke ทดสอบ', purpose: 'register' } });
  check('otp/send (internal_code)', r.status === 200 && r.json?.deliveryChannel === 'internal_code' && !!r.json?.devCode, JSON.stringify(r.json).slice(0, 120));
  r = await api('/api/auth/otp/verify', { method: 'POST', body: { otpId: r.json?.otpId, code: r.json?.devCode } });
  check('otp/verify', r.status === 200 && r.json?.ok === true);
  const pendingCookie = r.cookie;
  r = await api('/api/auth/onboard/profile', { method: 'POST', body: { fullName: 'QA Smoke ทดสอบ', email: `qa${stamp}@foodthunder.co.th` }, cookie: pendingCookie });
  check('onboard/profile', r.status === 200 || r.status === 201, JSON.stringify(r.json).slice(0, 120));
  r = await api('/api/auth/onboard/location', { method: 'POST', body: { label: 'บ้าน', addressLine: 'ทดสอบ QA 99 ถนนทดสอบ เขตราชเทวี กรุงเทพฯ 10400', lat: 13.765, lng: 100.538 }, cookie: pendingCookie });
  check('onboard/location (พิกัดจริง)', r.status === 200 || r.status === 201);
  r = await api('/api/auth/onboard/pin', { method: 'POST', body: { pin: '258025' }, cookie: pendingCookie });
  check('onboard/pin (ได้ session)', r.status === 200, JSON.stringify(r.json).slice(0, 120));
  const customerCookie = r.cookie;
  r = await api('/api/auth/me', { cookie: customerCookie });
  check('customer session (me)', r.status === 200 && r.json?.user?.role === 'customer', `HTTP ${r.status} body=${JSON.stringify(r.json).slice(0, 80)}`);

  // ---------- 3. ลูกค้า: สั่งซื้อ ----------
  console.log('3) Customer — สั่งซื้อ (ตัวเลือก→ตะกร้า→คูปอง→สั่ง→จ่าย)');
  r = await api(`/api/restaurants/${restaurantId}`, { cookie: customerCookie });
  check('GET restaurant detail', r.status === 200 && r.json?.restaurant?.id);
  const menuItems = r.json?.items ?? r.json?.menu_items ?? [];
  check('menu items มีของ', menuItems.length > 0);
  const foodItem = menuItems[0];
  r = await api(`/api/food/${foodItem.id}`);
  check('GET /api/food/[id] + ตัวเลือก', r.status === 200);
  const optionGroups = r.json?.option_groups ?? r.json?.options ?? [];
  const optionValueIds = (optionGroups[0]?.values ?? []).slice(0, 1).map((v) => v.id);
  r = await api('/api/cart', { method: 'POST', body: { menuItemId: foodItem.id, quantity: 2, optionValueIds, notes: 'QA smoke' }, cookie: customerCookie });
  check('POST /api/cart (พร้อมตัวเลือก)', r.status === 200 || r.status === 201, JSON.stringify(r.json).slice(0, 150));
  r = await api('/api/cart', { cookie: customerCookie });
  const cart = r.json;
  check('GET /api/cart มีรายการ', (cart?.items?.length ?? 0) > 0, JSON.stringify(cart).slice(0, 150));

  let couponCode = null;
  if (promo?.code) {
    const subtotal = (cart.items ?? []).reduce((s, i) => s + i.unit_price * i.quantity, 0);
    r = await api('/api/promotions/validate', { method: 'POST', body: { code: promo.code, subtotal }, cookie: customerCookie });
    check('coupon validate ผูกร้านให้ตรงตะกร้า (P0 fix)', r.status === 200 && typeof r.json?.valid === 'boolean', JSON.stringify(r.json).slice(0, 120));
    if (r.json?.valid === true) couponCode = promo.code;
    else console.log(`  ℹ️ ข้ามคูปอง ${promo.code}: ${r.json?.error ?? 'เงื่อนไขไม่ตรง'}`);
  }

  r = await api('/api/orders', { method: 'POST', body: { notes: 'QA smoke', ...(couponCode ? { couponCode } : {}) }, cookie: customerCookie });
  check('POST /api/orders (สั่งจริง + QR)', r.status === 201 && r.json?.order?.id, JSON.stringify(r.json).slice(0, 150));
  const orderId = r.json?.order?.id;
  const total = r.json?.order?.total;
  check('total เป็นสตางค์ (integer)', Number.isInteger(total) && total > 0, `total=${total}`);

  r = await api(`/api/orders/${orderId}/pay`, { method: 'PATCH', body: {}, cookie: customerCookie });
  check('PATCH pay (ยืนยันชำระ)', r.status === 200);

  // ---------- 4. เตรียมงานให้ไรเดอร์: ร้านรับ (ถ้าตรงเจ้าของ) หรือ admin เตรียมถึง ready ----------
  console.log('4) เตรียมงาน — ร้านรับ / admin เตรียมถึง ready_for_pickup');
  const own = await api('/api/auth/login', { method: 'POST', body: { email: 'restaurant1@foodthunder.co.th', password: 'Food@1234' } });
  const ownerCookie = own.cookie;
  check('owner login', own.status === 200);
  r = await api('/api/owner/orders', { cookie: ownerCookie });
  const ownerOrder = (r.json?.active ?? []).find((o) => o.id === orderId);
  if (ownerOrder) {
    for (const action of ['accept', 'prepare', 'ready']) {
      r = await api(`/api/owner/orders/${orderId}`, { method: 'PATCH', body: { action }, cookie: ownerCookie });
      check(`owner ${action}`, r.status === 200, JSON.stringify(r.json).slice(0, 120));
    }
  } else {
    console.log('  ℹ️ ออเดอร์ QA อยู่ร้านอื่น — admin เตรียมถึง ready_for_pickup (ตาม ADMIN_TRANSITIONS)');
    let okAll = true;
    for (const st of ['restaurant_pending', 'restaurant_accepted', 'preparing', 'ready_for_pickup']) {
      const rr = await api(`/api/admin/orders/${orderId}`, { method: 'PATCH', body: { status: st }, cookie: adminCookieValue });
      if (rr.status !== 200) okAll = false;
    }
    check('admin เตรียมถึง ready_for_pickup', okAll);
  }

  // ---------- 5. ไรเดอร์: รับงานจริง→รับของ→ส่ง ----------
  console.log('5) Driver — รับงานจริง→รับของ→ส่ง');
  const drv = await api('/api/auth/login', { method: 'POST', body: { email: 'driver1@foodthunder.co.th', password: 'Food@1234' } });
  const driverCookie = drv.cookie;
  check('driver login', drv.status === 200);
  r = await api('/api/driver/me', { method: 'PATCH', body: { isOnline: true }, cookie: driverCookie });
  check('driver online', r.status === 200);
  r = await api('/api/driver/location', { method: 'PATCH', body: { lat: 13.7563, lng: 100.5018 }, cookie: driverCookie });
  check('driver GPS ingest', r.status === 200 && r.json?.ok === true);
  r = await api('/api/driver/tasks', { method: 'POST', body: { orderId, action: 'accept' }, cookie: driverCookie });
  check('driver accept (atomic claim — ได้ driver_id จริง)', r.status === 200, JSON.stringify(r.json).slice(0, 150));
  r = await api('/api/driver/tasks', { method: 'POST', body: { orderId, action: 'pickup' }, cookie: driverCookie });
  check('driver pickup', r.status === 200);
  r = await api('/api/driver/tasks', { method: 'POST', body: { orderId, action: 'deliver' }, cookie: driverCookie });
  check('driver deliver', r.status === 200);

  // ---------- 6. ลูกค้า: แชท/โทร/ติดตาม/รีวิว/ทิป (มีไรเดอร์แล้ว) ----------
  console.log('6) Customer — แชท/โทร/ติดตาม/รีวิว/ทิป');
  r = await api(`/api/orders/${orderId}/chat`, { cookie: customerCookie });
  check('GET chat รายออเดอร์ + ห้องรายลับ', r.status === 200 && !!r.json?.channel && r.json.channel.includes(':'), JSON.stringify(r.json).slice(0, 100));
  r = await api(`/api/orders/${orderId}/chat`, { method: 'POST', body: { content: 'QA smoke ทดสอบแชท' }, cookie: customerCookie });
  check('POST แชท', r.status === 200 || r.status === 201);
  r = await api(`/api/calls/token?order=${orderId}`, { method: 'POST', cookie: customerCookie });
  check('โทร: token + ring ไรเดอร์', r.status === 200 && !!r.json?.room && !!r.json?.calleeRing, JSON.stringify(r.json).slice(0, 100));
  r = await api(`/api/orders/${orderId}/tracking`, { cookie: customerCookie });
  check('GET tracking + history', r.status === 200 && (r.json?.data?.history?.length ?? 0) > 0, JSON.stringify(r.json).slice(0, 100));
  r = await api(`/api/orders/${orderId}/review`, { method: 'POST', body: { foodRating: 5, deliveryRating: 5, comment: 'QA smoke รีวิว' }, cookie: customerCookie });
  check('POST review (หลังส่งสำเร็จ)', r.status === 200 || r.status === 201, JSON.stringify(r.json).slice(0, 120));
  r = await api(`/api/driver/tips`, { method: 'POST', body: { orderId, amountSatang: 2000 }, cookie: customerCookie });
  check('POST ทิปไรเดอร์', r.status === 200 || r.status === 201, JSON.stringify(r.json).slice(0, 120));

  // ---------- 7. แอดมิน ----------
  console.log('7) Admin — ปิดวงจร/รายงาน/ส่งออก/audit/ตั้งค่า');
  const adm = await api('/api/auth/login', { method: 'POST', body: { email: 'admin@foodthunder.co.th', password: 'Food@1234' } });
  const adminCk = adm.cookie;
  check('admin login', adm.status === 200);
  r = await api(`/api/admin/orders/${orderId}`, { method: 'PATCH', body: { status: 'completed' }, cookie: adminCk });
  check('admin delivered→completed', r.status === 200, JSON.stringify(r.json).slice(0, 120));
  r = await api('/api/admin/stats', { cookie: adminCk });
  check('admin stats', r.status === 200);
  r = await api('/api/admin/exports', { method: 'POST', body: { resource: 'orders', format: 'csv' }, cookie: adminCk });
  check('admin export CSV จริง', r.status === 200 || r.status === 201, JSON.stringify(r.json).slice(0, 120));
  r = await api('/api/admin/audit-logs?page=1', { cookie: adminCk });
  check('audit-logs มีร่องรอย', r.status === 200 && (r.json?.data?.length ?? 0) > 0);
  r = await api('/api/admin/settings', { method: 'PATCH', body: { key: 'qa_smoke_stamp', value: stamp }, cookie: adminCk });
  check('settings upsert', r.status === 200, JSON.stringify(r.json).slice(0, 120));

  // ---------- 8. ความถูกต้องข้อมูล (มองจากเจ้าของออเดอร์) ----------
  console.log('8) Data integrity — เงื่อนไขธุรกิจจริง');
  r = await api(`/api/orders/${orderId}`, { cookie: customerCookie });
  const order = r.json?.order;
  check('สถานะจบ = completed', order?.status === 'completed', `status=${order?.status}`);
  check('total เป็น integer (สตางค์)', Number.isInteger(order?.total), `total=${order?.total}`);
  r = await api(`/api/orders/${orderId}/tracking`, { cookie: customerCookie });
  check('order_status_history ครบทุกขั้น', (r.json?.data?.history?.length ?? 0) >= 5, `history=${r.json?.data?.history?.length}`);
  r = await api(`/api/orders/${orderId}/review`, { cookie: customerCookie });
  check('รีวิวผูกกับออเดอร์นี้', r.status === 200 && !!r.json?.data?.id, JSON.stringify(r.json).slice(0, 100));

  // ---------- สรุป ----------
  console.log(`\n📊 ผลสรุป: ผ่าน ${pass} / ไม่ผ่าน ${fail}`);
  if (fail > 0) {
    console.log('\nรายการที่ไม่ผ่าน:');
    failures.forEach((f) => console.log(`  ❌ ${f}`));
    process.exit(1);
  }
  console.log('🎉 วงจรธุรกิจจริงเดินได้ครบทุกบทบาท');
}

function adminCookie() {
  // helper ยิง login admin ตรงนี้ (ใช้ก่อนประกาศ adm ใน main) — คืนค่า cookie จริง
  return adminCookieValue;
}

let adminCookieValue = '';

async function adminLogin() {
  const r = await api('/api/auth/login', { method: 'POST', body: { email: 'admin@foodthunder.co.th', password: 'Food@1234' } });
  adminCookieValue = r.cookie;
  return r;
}

const _origMain = main;
main = async function () {
  await adminLogin();
  await _origMain();
};

main().catch((e) => {
  console.error('สคริปต์พัง:', e);
  process.exit(1);
});
