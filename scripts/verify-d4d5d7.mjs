// verify-d4d5d7.mjs — E2E รวม D4 เวรพนักงาน + D5 payout + D7 outbox (REMAINING-WORK)
// รันกับ dev server: node scripts/verify-d4d5d7.mjs [baseUrl]
// (D6 ประวัติพิกัดตรวจผ่านฐานข้อมูลจริงหลังรัน — ดูคำสั่งในเอกสาร)

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

const TEST_IP = `198.22.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250) + 1}`;

async function main() {
  console.log(`\n🧪 Verify D4+D5+D7 — ${BASE}\n`);

  // ---------- บัญชีผู้ใช้ ----------
  let r = await api('/api/auth/login', { method: 'POST', body: { email: 'admin@foodthunder.co.th', password: 'Food@1234' } });
  const adminCookie = r.cookie;
  check('แอดมินล็อกอิน', r.status === 200);
  r = await api('/api/auth/login', { method: 'POST', body: { email: 'restaurant1@foodthunder.co.th', password: 'Food@1234' } });
  const ownerCookie = r.cookie;
  check('เจ้าของร้านล็อกอิน', r.status === 200);
  r = await api('/api/auth/login', { method: 'POST', body: { email: 'driver1@foodthunder.co.th', password: 'Food@1234' } });
  const driverCookie = r.cookie;
  check('ไรเดอร์ล็อกอิน', r.status === 200);

  // ---------- D4: เวรพนักงาน ----------
  console.log('\nD4) เวรพนักงาน (staff_shifts)');
  const staff = (await api('/api/owner/staff', { cookie: ownerCookie })).json;
  const staffList = staff?.staff ?? staff?.data ?? [];
  const anyProfile = staffList.find?.((s) => s.isActive) ?? staffList[0];
  check('ร้านมีพนักงานให้สร้างเวร', !!anyProfile, JSON.stringify(staffList).slice(0, 100));

  r = await api('/api/owner/shifts', {
    method: 'POST',
    body: {
      restaurantProfileId: anyProfile?.id,
      startsAt: new Date(Date.now() + 86400000).toISOString(),
      endsAt: new Date(Date.now() + 86400000 + 8 * 3600000).toISOString(),
      note: 'กะทดสอบ D4',
    },
    cookie: ownerCookie,
  });
  check('สร้างเวร → scheduled', r.status === 201 && r.json?.data?.status === 'scheduled', `HTTP ${r.status} ${JSON.stringify(r.json).slice(0, 100)}`);
  const shiftId = r.json?.data?.id;
  r = await api('/api/owner/shifts', { cookie: ownerCookie });
  check('GET เวรของร้านมีรายการใหม่', r.status === 200 && (r.json?.data ?? []).some((s) => s.id === shiftId));
  r = await api(`/api/owner/shifts/${shiftId}`, { method: 'PATCH', body: { status: 'completed' }, cookie: ownerCookie });
  check('ปิดเวร → completed', r.status === 200 && r.json?.data?.status === 'completed', `HTTP ${r.status}`);

  // ---------- D5: payout ไรเดอร์ ----------
  console.log('\nD5) การจ่ายเงินไรเดอร์ (payout_ledger)');
  r = await api('/api/auth/me', { cookie: driverCookie });
  const driverUserId = r.json?.user?.id;
  check('พบไรเดอร์ (ผู้รับเงิน)', !!driverUserId, `HTTP ${r.status}`);

  r = await api(`/api/admin/drivers/${driverUserId}/payouts`, { method: 'POST', body: { amountSatang: 85000 }, cookie: adminCookie });
  check('บันทึกการโอน ฿850 → pending', r.status === 201 && r.json?.data?.status === 'pending', `HTTP ${r.status} ${JSON.stringify(r.json).slice(0, 100)}`);
  const payoutId = r.json?.data?.id;
  r = await api('/api/driver/payouts', { cookie: driverCookie });
  check('ไรเดอร์เห็นการจ่ายเงินของตัวเอง', r.status === 200 && (r.json?.data ?? []).some((p) => p.id === payoutId), `HTTP ${r.status}`);
  r = await api(`/api/admin/payouts/${payoutId}`, { method: 'PATCH', body: { batchId: '9f1c2a3b-4d5e-4f60-8a9b-0c1d2e3f4a5b' }, cookie: adminCookie });
  check('ยืนยันโอน → settled', r.status === 200 && r.json?.data?.status === 'settled', `HTTP ${r.status}`);
  r = await api(`/api/admin/payouts/${payoutId}`, { method: 'PATCH', body: { batchId: 'X' }, cookie: adminCookie });
  check('ยืนยันซ้ำ → 409', r.status === 409, `HTTP ${r.status}`);

  // ---------- D7: outbox ----------
  console.log('\nD7) ท่อเหตุการณ์ (realtime_outbox)');
  // สร้างเหตุการณ์: เปลี่ยนสถานะออเดอร์ผ่านแอดมิน (pushStatusHistory -> enqueue)
  const rs = (await api('/api/restaurants?limit=5')).json?.data?.[0]?.id;
  const detail = await api(`/api/restaurants/${rs}`);
  const fi = (detail.json?.items ?? detail.json?.menu_items ?? [])[0];
  const phone = `0998${stamp2().slice(-6)}${Math.floor(Math.random() * 9)}`.slice(0, 10);
  r = await api('/api/auth/otp/send', { method: 'POST', body: { phone, email: `d7${stamp2()}@foodthunder.co.th`, fullName: 'D7 ทดสอบ', purpose: 'register' } });
  check('D7 otp/send', r.status === 200 && !!r.json?.devCode, `HTTP ${r.status} ${JSON.stringify(r.json).slice(0, 120)}`);
  r = await api('/api/auth/otp/verify', { method: 'POST', body: { otpId: r.json?.otpId, code: r.json?.devCode } });
  const pcReg = r.cookie;
  check('D7 otp/verify', r.status === 200 && !!pcReg, `HTTP ${r.status}`);
  r = await api('/api/auth/onboard/profile', { method: 'POST', body: { fullName: 'D7 ทดสอบ', email: `d7${stamp2()}@foodthunder.co.th` }, cookie: pcReg });
  check('D7 onboard/profile', r.status === 200 || r.status === 201, `HTTP ${r.status} ${JSON.stringify(r.json).slice(0, 100)}`);
  r = await api('/api/auth/onboard/location', { method: 'POST', body: { label: 'บ้าน', addressLine: 'D7 99', lat: 13.765, lng: 100.538 }, cookie: pcReg });
  check('D7 onboard/location', r.status === 200 || r.status === 201, `HTTP ${r.status}`);
  await api('/api/auth/onboard/pin', { method: 'POST', body: { pin: '258025' }, cookie: pcReg });
  r = await api('/api/auth/onboard/pin', { method: 'POST', body: { pin: '258025' }, cookie: pcReg });
  const custCookie = r.cookie;
  check('D7 onboard/pin', r.status === 200 && !!custCookie, `HTTP ${r.status} ${JSON.stringify(r.json).slice(0, 100)}`);
  await api('/api/cart', { method: 'POST', body: { menuItemId: fi.id, quantity: 1, optionValueIds: [] }, cookie: custCookie });
  r = await api('/api/orders', { method: 'POST', body: { paymentMethod: 'cash' }, cookie: custCookie });
  const orderId = r.json?.order?.id;
  check('ออเดอร์สำหรับทดสอบ outbox', !!orderId, `HTTP ${r.status} ${JSON.stringify(r.json).slice(0, 120)}`);
  // เปลี่ยนสถานะผ่านแอดมิน → pushStatusHistory → outbox event
  r = await api(`/api/admin/orders/${orderId}`, { method: 'PATCH', body: { status: 'restaurant_pending' }, cookie: adminCookie });
  check('เปลี่ยนสถานะ (สร้าง outbox event)', r.status === 200, `HTTP ${r.status}`);
  r = await api('/api/admin/outbox', { cookie: adminCookie });
  const pendingEvents = (r.json?.data?.pending ?? []).filter((e) => e.channel.includes(orderId));
  check('outbox มีเหตุการณ์ค้างของออเดอร์นี้', pendingEvents.length >= 1, `นับ=${pendingEvents.length}`);
  r = await api('/api/admin/outbox', { method: 'POST', cookie: adminCookie });
  const drained = (r.json?.data?.delivered ?? 0) > 0;
  check('drain ส่งเหตุการณ์ออกทาง Realtime broadcast', r.status === 200 && drained, `HTTP ${r.status} ${JSON.stringify(r.json?.data ?? {})}`);
  r = await api('/api/admin/outbox', { cookie: adminCookie });
  check('หลัง drain = ไม่มีเหตุการณ์ค้างของออเดอร์นี้', !((r.json?.data?.pending ?? []).some((e) => e.channel.includes(orderId))), `ค้าง=${(r.json?.data?.pending ?? []).length}`);

  console.log(`\n📊 ผลสรุป: ผ่าน ${pass} / ไม่ผ่าน ${fail}`);
  if (fail > 0) {
    console.log('รายการตก:');
    failures.forEach((f) => console.log(`  - ${f}`));
    process.exit(1);
  }
}

function stamp2() {
  return Date.now().toString().slice(-8);
}

main().catch((e) => {
  console.error('สคริปต์พัง:', e);
  process.exit(1);
});
