// verify-refund-flow.mjs — E2E ระบบคืนเงิน (REMAINING-WORK D1 / v4 ข้อ 6)
// รันกับ dev server: node scripts/verify-refund-flow.mjs [baseUrl]
// วงจร: เติมเงิน ฿1,000 (อนุมัติ) → สั่งด้วยกระเป๋าเงิน (หักจริง) → ขอคืนเงิน
//        → แอดมินอนุมัติ → เงินคืนเข้ากระเป๋า + ออเดอร์ refunded + แจ้งเตือน → วงจรปฏิเสธ → audit

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

const TEST_IP = `198.21.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250) + 1}`;
const PNG_B64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const stamp = Date.now().toString().slice(-8);

async function uploadSlip(transactionId, cookie) {
  const form = new FormData();
  form.append('transactionId', transactionId);
  form.append('slip', new Blob([Buffer.from(PNG_B64, 'base64')], { type: 'image/png' }), 'slip.png');
  const res = await fetch(`${BASE}/api/wallet/topup/slip`, { method: 'POST', headers: { Cookie: cookie }, body: form });
  return { status: res.status };
}

async function main() {
  console.log(`\n🧪 Verify Refund Flow (D1) — ${BASE}\n`);

  // ---------- 1. แอดมิน + ลูกค้าใหม่ ----------
  let r = await api('/api/auth/login', { method: 'POST', body: { email: 'admin@foodthunder.co.th', password: 'Food@1234' } });
  const adminCookie = r.cookie;
  check('แอดมินล็อกอิน', r.status === 200 && !!adminCookie);

  const phone = `0997${stamp.slice(-6)}${Math.floor(Math.random() * 9)}`.slice(0, 10);
  r = await api('/api/auth/otp/send', { method: 'POST', body: { phone, email: `ref${stamp}@foodthunder.co.th`, fullName: 'Refund ทดสอบ', purpose: 'register' } });
  r = await api('/api/auth/otp/verify', { method: 'POST', body: { otpId: r.json?.otpId, code: r.json?.devCode } });
  const pcReg = r.cookie;
  await api('/api/auth/onboard/profile', { method: 'POST', body: { fullName: 'Refund ทดสอบ', email: `ref${stamp}@foodthunder.co.th` }, cookie: pcReg });
  await api('/api/auth/onboard/location', { method: 'POST', body: { label: 'บ้าน', addressLine: 'Refund 99 กรุงเทพฯ', lat: 13.765, lng: 100.538 }, cookie: pcReg });
  r = await api('/api/auth/onboard/pin', { method: 'POST', body: { pin: '258025' }, cookie: pcReg });
  const customerCookie = r.cookie;
  check('ลูกค้าใหม่พร้อม (PIN 258025)', r.status === 200);

  // ---------- 2. เติมเงิน ฿1,000 ครบวงจร ----------
  r = await api('/api/auth/verify-pin', { method: 'POST', body: { pin: '258025' }, cookie: customerCookie });
  check('verify-pin', r.status === 200);
  r = await api('/api/wallet/topup', { method: 'POST', body: { amount: 1000 }, cookie: customerCookie });
  const txId = r.json?.data?.transactionId;
  await uploadSlip(txId, customerCookie);
  r = await api(`/api/admin/topups/${txId}`, { method: 'PATCH', body: { action: 'approve' }, cookie: adminCookie });
  check('เติมเงิน ฿1,000 อนุมัติแล้ว', r.status === 200);
  r = await api('/api/wallet', { cookie: customerCookie });
  const balance0 = r.json?.data?.balance ?? 0;
  check('ยอดกระเป๋า = 100,000 สตางค์', balance0 === 100000, `balance=${balance0}`);

  // ---------- 3. สั่งด้วยกระเป๋าเงิน (หักจริง) ----------
  const rs = (await api('/api/restaurants?limit=5')).json?.data?.[0]?.id;
  const detail = await api(`/api/restaurants/${rs}`);
  const fi = (detail.json?.items ?? detail.json?.menu_items ?? [])[0];
  const fr = await api(`/api/food/${fi.id}`);
  const ovs = ((fr.json?.option_groups ?? [])[0]?.values ?? []).slice(0, 1).map((v) => v.id);
  await api('/api/cart', { method: 'POST', body: { menuItemId: fi.id, quantity: 1, optionValueIds: ovs }, cookie: customerCookie });
  r = await api('/api/orders', { method: 'POST', body: { paymentMethod: 'wallet' }, cookie: customerCookie });
  const orderId = r.json?.order?.id;
  const orderTotal = r.json?.order?.total ?? 0;
  check('สั่งด้วยกระเป๋าเงิน → paid หักจริง', r.status === 201 && r.json?.order?.status === 'paid', `HTTP ${r.status} total=${orderTotal}`);
  r = await api('/api/wallet', { cookie: customerCookie });
  const balance1 = r.json?.data?.balance ?? 0;
  check('กระเป๋าถูกหักตรงยอด', balance1 === balance0 - orderTotal, `หลังสั่ง=${balance1} ควรเหลือ ${balance0 - orderTotal}`);

  // ---------- 4. ขอคืนเงิน ----------
  r = await api(`/api/orders/${orderId}/refund-request`, { method: 'POST', body: { reason: 'สั่งผิดเมนู ต้องการยกเลิกและขอเงินคืน' }, cookie: customerCookie });
  check('ส่งคำขอคืนเงิน → pending', r.status === 201 && r.json?.data?.status === 'manual_review', `HTTP ${r.status} ${JSON.stringify(r.json).slice(0, 100)}`);
  r = await api(`/api/orders/${orderId}/refund-request`, { method: 'POST', body: { reason: 'ขอซ้ำ' }, cookie: customerCookie });
  check('ขอซ้ำ → 409', r.status === 409, `HTTP ${r.status}`);
  r = await api(`/api/orders/${orderId}/refund-request`, { cookie: customerCookie });
  check('GET สถานะ = pending', r.status === 200 && r.json?.data?.status === 'manual_review', `HTTP ${r.status}`);

  // ---------- 5. แอดมินอนุมัติ ----------
  r = await api('/api/admin/refunds', { cookie: adminCookie });
  const reqRow = (r.json?.data ?? []).find((x) => x.order_id === orderId);
  check('แอดมินเห็นคำขอ (ระบุออเดอร์/ยอด)', r.status === 200 && reqRow?.status === 'manual_review' && reqRow?.amount === orderTotal, `HTTP ${r.status} found=${!!reqRow}`);
  r = await api(`/api/admin/refunds/${reqRow?.id}`, { method: 'PATCH', body: { action: 'approve' }, cookie: adminCookie });
  check('แอดมินอนุมัติ → approved', r.status === 200 && r.json?.data?.status === 'completed', `HTTP ${r.status}`);

  // ---------- 6. เงินคืนเข้ากระเป๋า + ออเดอร์ refunded + แจ้งเตือน ----------
  r = await api('/api/wallet', { cookie: customerCookie });
  const balance2 = r.json?.data?.balance ?? 0;
  check('เงินคืนเข้ากระเป๋าตรงยอด (กลับเท่าก่อนสั่ง)', balance2 === balance0, `หลังคืน=${balance2} ควร=${balance0}`);
  r = await api(`/api/orders/${orderId}`, { cookie: customerCookie });
  check('ออเดอร์ = refunded', r.status === 200 && r.json?.order?.status === 'refunded', `HTTP ${r.status}`);
  r = await api('/api/notifications', { cookie: customerCookie });
  check('แจ้งเตือน "คืนเงินสำเร็จ"', r.status === 200 && (r.json?.data ?? []).some((n) => n.title === 'คืนเงินสำเร็จ'));

  // ---------- 7. วงจรปฏิเสธ ----------
  await api('/api/cart', { method: 'POST', body: { menuItemId: fi.id, quantity: 1, optionValueIds: ovs }, cookie: customerCookie });
  r = await api('/api/orders', { method: 'POST', body: { paymentMethod: 'wallet' }, cookie: customerCookie });
  const order2 = r.json?.order;
  check('ออเดอร์ที่ 2 (สำหรับปฏิเสธ)', r.status === 201 && !!order2);
  r = await api(`/api/orders/${order2.id}/refund-request`, { method: 'POST', body: { reason: 'ทดสอบกรณีปฏิเสธคำขอ' }, cookie: customerCookie });
  check('ส่งคำขอคืนเงินที่ 2', r.status === 201);
  r = await api('/api/admin/refunds', { cookie: adminCookie });
  const req2 = (r.json?.data ?? []).find((x) => x.order_id === order2.id);
  const balBeforeReject = (await api('/api/wallet', { cookie: customerCookie })).json?.data?.balance ?? 0;
  r = await api(`/api/admin/refunds/${req2?.id}`, { method: 'PATCH', body: { action: 'reject', note: 'ไม่เข้าเงื่อนไขคืนเงิน' }, cookie: adminCookie });
  check('แอดมินปฏิเสธ → rejected', r.status === 200 && r.json?.data?.status === 'failed', `HTTP ${r.status}`);
  r = await api('/api/notifications', { cookie: customerCookie });
  check('แจ้งเตือน "คำขอคืนเงินถูกปฏิเสธ"', r.status === 200 && (r.json?.data ?? []).some((n) => n.title === 'คำขอคืนเงินถูกปฏิเสธ'));
  r = await api('/api/wallet', { cookie: customerCookie });
  check('ยอดกระเป๋าไม่เปลี่ยนหลังปฏิเสธ', (r.json?.data?.balance ?? 0) === balBeforeReject, `ก่อน=${balBeforeReject} หลัง=${r.json?.data?.balance}`);

  // ---------- 8. audit ----------
  r = await api('/api/admin/audit-logs?limit=20', { cookie: adminCookie });
  const audits = r.json?.data ?? [];
  check('audit log มี refund.approve/reject', r.status === 200 && audits.some((a) => a.action === 'refund.approve') && audits.some((a) => a.action === 'refund.reject'), `HTTP ${r.status} นับ=${audits.length}`);

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
