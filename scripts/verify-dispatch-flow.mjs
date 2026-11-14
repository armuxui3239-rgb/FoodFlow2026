// verify-dispatch-flow.mjs — E2E ระบบเสนองานอัตโนมัติ (REMAINING-WORK D3 / v4 ข้อ 3)
// รันกับ dev server: node scripts/verify-dispatch-flow.mjs [baseUrl]
// วงจร: สั่ง(COD) → ร้านรับ → เตรียม → พร้อมส่ง (ระบบเสนองานอัตโนมัติ) → ไรเดอร์เห็นข้อเสนอ
//        → รับแบบ atomic → ออเดอร์ driver_assigned → ข้อเสนออื่นปิด → งานหลุดจากกองสาธารณะ

const BASE = process.argv[2] || 'http://localhost:3000';
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
  try { json = await res.json(); } catch { /* ignore */ }
  return { status: res.status, json, cookie: cookieOf(res) };
}

const TEST_IP = `198.20.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250) + 1}`;
const stamp = Date.now().toString().slice(-8);

async function main() {
  console.log(`\n🧪 Verify Dispatch Flow (D3) — ${BASE}\n`);

  // ---------- 1. แอดมิน + ลูกค้า + ออเดอร์ ----------
  let r = await api('/api/auth/login', { method: 'POST', body: { email: 'admin@foodthunder.co.th', password: 'Food@1234' } });
  const adminCookie = r.cookie;
  check('แอดมินล็อกอิน', r.status === 200 && !!adminCookie);

  const phone = `0996${stamp.slice(-6)}${Math.floor(Math.random() * 9)}`.slice(0, 10);
  r = await api('/api/auth/otp/send', { method: 'POST', body: { phone, email: `dsp${stamp}@foodthunder.co.th`, fullName: 'Dispatch ทดสอบ', purpose: 'register' } });
  r = await api('/api/auth/otp/verify', { method: 'POST', body: { otpId: r.json?.otpId, code: r.json?.devCode } });
  const pcReg = r.cookie;
  await api('/api/auth/onboard/profile', { method: 'POST', body: { fullName: 'Dispatch ทดสอบ', email: `dsp${stamp}@foodthunder.co.th` }, cookie: pcReg });
  await api('/api/auth/onboard/location', { method: 'POST', body: { label: 'บ้าน', addressLine: 'Dispatch 99 กรุงเทพฯ', lat: 13.765, lng: 100.538 }, cookie: pcReg });
  r = await api('/api/auth/onboard/pin', { method: 'POST', body: { pin: '258025' }, cookie: pcReg });
  const customerCookie = r.cookie;
  check('ลูกค้าใหม่พร้อม', r.status === 200);

  // สั่งแบบพร้อมเพย์ (สถานะ pending_payment — ยกเลิก/ตรวจได้ครบ)
  const rs = (await api('/api/restaurants?limit=5')).json?.data?.[0]?.id;
  const detail = await api(`/api/restaurants/${rs}`);
  const fi = (detail.json?.items ?? detail.json?.menu_items ?? [])[0];
  await api('/api/cart', { method: 'POST', body: { menuItemId: fi.id, quantity: 1, optionValueIds: [] }, cookie: customerCookie });
  r = await api('/api/orders', { method: 'POST', body: { paymentMethod: 'cash' }, cookie: customerCookie });
  const orderId = r.json?.order?.id;
  const orderCode = r.json?.order?.order_code;
  check('สั่งออเดอร์ (COD — เข้าร้านได้ทันที)', r.status === 201 && !!orderId, `HTTP ${r.status}`);

  // ---------- 2. ร้านรับ → เตรียม → พร้อมส่ง (owner ก่อน ถ้าไม่ใช่ร้านตัวเอง fallback admin ตาม qa-smoke) ----------
  r = await api('/api/auth/login', { method: 'POST', body: { email: 'restaurant1@foodthunder.co.th', password: 'Food@1234' } });
  const ownerCookie = r.cookie;
  check('เจ้าของร้านล็อกอิน', r.status === 200 && !!ownerCookie);
  let dispatched = 0;
  const ownerOrder = (await api('/api/owner/orders', { cookie: ownerCookie })).json?.active?.find((o) => o.id === orderId);
  if (ownerOrder) {
    for (const action of ['accept', 'prepare', 'ready']) {
      r = await api(`/api/owner/orders/${orderId}`, { method: 'PATCH', body: { action }, cookie: ownerCookie });
      dispatched = r.json?.dispatched ?? dispatched;
    }
    check('owner พร้อมส่ง → ระบบเสนองานอัตโนมัติ', dispatched >= 1, `dispatched=${dispatched}`);
  } else {
    let okAll = true;
    for (const st of ['restaurant_pending', 'restaurant_accepted', 'preparing', 'ready_for_pickup']) {
      const rr = await api(`/api/admin/orders/${orderId}`, { method: 'PATCH', body: { status: st }, cookie: adminCookie });
      if (rr.status !== 200) okAll = false;
      dispatched = rr.json?.dispatched ?? dispatched;
    }
    check('admin พร้อมส่ง → ระบบเสนองานอัตโนมัติ', okAll && dispatched >= 1, `dispatched=${dispatched}`);
  }
  if (dispatched === 0) {
    console.log('  ⚠ ไม่มีไรเดอร์ออนไลน์ที่มี GPS — ข้ามส่วนทดสอบไรเดอร์ (เปิดไรเดอร์ก่อนแล้วรันใหม่)');
    process.exit(fail > 0 ? 1 : 0);
  }

  // ---------- 3. ไรเดอร์เห็นข้อเสนอ + รับแบบ atomic ----------
  let foundOffer = null;
  let driverCookie = '';
  for (const dEmail of ['driver1@foodthunder.co.th', 'driver2@foodthunder.co.th', 'driver3@foodthunder.co.th', 'driver4@foodthunder.co.th']) {
    const dr = await api('/api/auth/login', { method: 'POST', body: { email: dEmail, password: 'Food@1234' } });
    if (dr.status !== 200) continue;
    const drCookie = dr.cookie;
    await api('/api/driver/me', { method: 'PATCH', body: { isOnline: true }, cookie: drCookie });
    const dis = await api('/api/driver/dispatch', { cookie: drCookie });
    const offer = (dis.json?.data ?? []).find((o) => o.orderId === orderId);
    if (offer) { foundOffer = { offer, cookie: drCookie, email: dEmail }; break; }
  }
  check('มีไรเดอร์ได้รับข้อเสนองานนี้', !!foundOffer);
  if (!foundOffer) {
    process.exit(fail > 0 ? 1 : 0);
  }
  driverCookie = foundOffer.cookie;

  // งานนี้ต้องหลุดจากกองสาธารณะ (มีข้อเสนอค้างอยู่)
  r = await api('/api/driver/tasks', { cookie: driverCookie });
  check('งานหลุดจากกองสาธารณะระหว่างมีข้อเสนอ', !(r.json?.available ?? []).some((o) => o.id === orderId));

  // รับ (atomic คนแรกชนะ)
  r = await api(`/api/driver/dispatch/${foundOffer.offer.id}`, { method: 'POST', body: { action: 'accept' }, cookie: driverCookie });
  check('รับข้อเสนอ → driver_assigned', r.status === 200 && r.json?.status === 'driver_assigned', `HTTP ${r.status} ${JSON.stringify(r.json).slice(0, 100)}`);

  // ---------- 4. หลังรับ: ออเดอร์ผูกไรเดอร์ + ข้อเสนออื่นปิด + ยอมรับซ้ำ 409 ----------
  r = await api(`/api/orders/${orderId}`, { cookie: customerCookie });
  check('ออเดอร์ผูกไรเดอร์จริง', r.status === 200 && r.json?.order?.driver_id != null && r.json?.order?.status === 'driver_assigned');
  r = await api(`/api/driver/dispatch/${foundOffer.offer.id}`, { method: 'POST', body: { action: 'accept' }, cookie: driverCookie });
  check('รับซ้ำ → 409', r.status === 409, `HTTP ${r.status}`);
  r = await api('/api/driver/tasks', { cookie: driverCookie });
  check('งานยังอยู่ใน "งานของฉัน" หลังรับ', (r.json?.mine ?? []).some((o) => o.id === orderId));

  console.log(`\n📊 ผลสรุป: ผ่าน ${pass} / ไม่ผ่าน ${fail}`);
  if (fail > 0) {
    console.log('รายการตก:');
    failures.forEach((f) => console.log(`  - ${f}`));
    process.exit(1);
  }
}

main().catch((e) => {
  console.error('สคริปต์พัง:', e);
  process.exit(1);
});
