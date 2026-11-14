// verify-topup-flow.mjs — E2E วงจรเติมเงินครบวงจร (UI-ALIGNMENT-PLAN เฟส 5.1)
// รันกับ dev server ที่กำลังทำงาน: node scripts/verify-topup-flow.mjs [baseUrl]
// วงจร: สมัครลูกค้าใหม่(รหัสภายใน) → ยืนยัน PIN (ผิด/ถูก) → เติมเงินยอดกำหนดเอง → แนบสลิป
//        → แอดมินดูสลิป → อนุมัติ → ยอดเข้ากระเป๋า + แจ้งเตือน → กรณีปฏิเสธ + แจ้งเตือน

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
    headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await res.json(); } catch { /* non-json */ }
  return { status: res.status, json, cookie: cookieOf(res) };
}

// สลิปทดสอบ — PNG 1x1
const PNG_B64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

async function uploadSlip(transactionId, cookie) {
  const form = new FormData();
  form.append('transactionId', transactionId);
  form.append('slip', new Blob([Buffer.from(PNG_B64, 'base64')], { type: 'image/png' }), 'slip.png');
  const res = await fetch(`${BASE}/api/wallet/topup/slip`, {
    method: 'POST',
    headers: { Cookie: cookie },
    body: form,
  });
  let json = null;
  try { json = await res.json(); } catch { /* ignore */ }
  return { status: res.status, json };
}

const stamp = Date.now().toString().slice(-8);

async function main() {
  console.log(`\n🧪 Verify Topup Flow — ${BASE}\n`);

  // ---------- 1. แอดมินล็อกอิน ----------
  let r = await api('/api/auth/login', { method: 'POST', body: { email: 'admin@foodthunder.co.th', password: 'Food@1234' } });
  check('แอดมินล็อกอิน', r.status === 200 && !!r.cookie, `HTTP ${r.status}`);
  const adminCookie = r.cookie;

  // ---------- 2. ลูกค้าใหม่ (รหัสภายใน) ----------
  r = await api('/api/auth/otp/send', { method: 'POST', body: { phone: `0992${stamp.slice(-6)}${Math.floor(Math.random() * 9)}`.slice(0, 10), email: `topup${stamp}@foodthunder.co.th`, fullName: 'Topup Flow ทดสอบ', purpose: 'register' } });
  check('otp/send', r.status === 200 && !!r.json?.devCode, `HTTP ${r.status}`);
  r = await api('/api/auth/otp/verify', { method: 'POST', body: { otpId: r.json?.otpId, code: r.json?.devCode } });
  const pendingCookie = r.cookie;
  check('otp/verify', r.status === 200 && r.json?.ok === true);
  r = await api('/api/auth/onboard/profile', { method: 'POST', body: { fullName: 'Topup Flow ทดสอบ', email: `topup${stamp}@foodthunder.co.th` }, cookie: pendingCookie });
  check('onboard/profile', r.status === 200 || r.status === 201);
  r = await api('/api/auth/onboard/location', { method: 'POST', body: { label: 'บ้าน', addressLine: 'ทดสอบเติมเงิน 99 กรุงเทพฯ 10400', lat: 13.765, lng: 100.538 }, cookie: pendingCookie });
  check('onboard/location', r.status === 200 || r.status === 201);
  r = await api('/api/auth/onboard/pin', { method: 'POST', body: { pin: '258025' }, cookie: pendingCookie });
  check('onboard/pin', r.status === 200);
  const customerCookie = r.cookie;
  check('ได้ session ลูกค้า', !!customerCookie);

  // ---------- 3. ยืนยัน PIN (ผิด → ถูก) ----------
  r = await api('/api/auth/verify-pin', { method: 'POST', body: { pin: '111111' }, cookie: customerCookie });
  check('verify-pin ผิด → 401 (นับครั้ง)', r.status === 401, `HTTP ${r.status} ${JSON.stringify(r.json)}`);
  r = await api('/api/auth/verify-pin', { method: 'POST', body: { pin: '258025' }, cookie: customerCookie });
  check('verify-pin ถูก → ok', r.status === 200 && r.json?.ok === true, `HTTP ${r.status}`);

  // ---------- 4. เติมเงินยอดกำหนดเอง + สลิป ----------
  r = await api('/api/wallet/topup', { method: 'POST', body: { amount: 777 }, cookie: customerCookie });
  check('เติมเงินยอดกำหนดเอง ฿777 → QR', r.status === 201 && !!r.json?.data?.transactionId && !!r.json?.data?.qrDataUrl, `HTTP ${r.status} ${JSON.stringify(r.json).slice(0, 100)}`);
  const txId = r.json?.data?.transactionId;

  r = await uploadSlip(txId, customerCookie);
  check('แนบสลิป → Storage', r.status === 200 && r.json?.data?.ok === true, `HTTP ${r.status} ${JSON.stringify(r.json).slice(0, 120)}`);

  // ---------- 5. แอดมินตรวจ ----------
  r = await api('/api/admin/topups', { cookie: adminCookie });
  const found = (r.json?.data ?? []).find((x) => x.id === txId);
  check('แอดมินเห็นรายการ + สลิป', r.status === 200 && found?.status === 'pending' && !!found?.proof_url, `HTTP ${r.status} found=${!!found}`);

  r = await fetch(`${BASE}/api/admin/topups/${txId}/slip`, { headers: { Cookie: adminCookie } });
  check('แอดมินดูภาพสลิป', r.status === 200 && (r.headers.get('content-type') ?? '').startsWith('image/'), `HTTP ${r.status} type=${r.headers.get('content-type')}`);

  r = await api(`/api/admin/topups/${txId}`, { method: 'PATCH', body: { action: 'approve' }, cookie: adminCookie });
  check('แอดมินอนุมัติ → completed', r.status === 200 && r.json?.data?.status === 'completed', `HTTP ${r.status} ${JSON.stringify(r.json).slice(0, 100)}`);

  // ---------- 6. ยอดเข้ากระเป๋า + แจ้งเตือน ----------
  r = await api('/api/wallet', { cookie: customerCookie });
  const balance = r.json?.data?.balance ?? 0;
  check('ยอดเข้ากระเป๋าถูกต้อง (77,700 สตางค์)', r.status === 200 && balance === 77700, `HTTP ${r.status} balance=${balance}`);
  r = await api('/api/notifications', { cookie: customerCookie });
  check('แจ้งเตือน "เติมเงินสำเร็จ"', r.status === 200 && (r.json?.data ?? []).some((n) => n.title === 'เติมเงินสำเร็จ'), `HTTP ${r.status}`);

  // ---------- 7. กรณีปฏิเสธ ----------
  r = await api('/api/wallet/topup', { method: 'POST', body: { amount: 500 }, cookie: customerCookie });
  const tx2 = r.json?.data?.transactionId;
  check('เติมเงินรายการที่ 2 (ปฏิเสธ)', r.status === 201 && !!tx2);
  r = await uploadSlip(tx2, customerCookie);
  check('แนบสลิปรายการที่ 2', r.status === 200);
  r = await api(`/api/admin/topups/${tx2}`, { method: 'PATCH', body: { action: 'reject', note: 'สลิปไม่ตรงยอด' }, cookie: adminCookie });
  check('แอดมินปฏิเสธ → rejected', r.status === 200 && r.json?.data?.status === 'rejected', `HTTP ${r.status} ${JSON.stringify(r.json).slice(0, 100)}`);
  r = await api('/api/notifications', { cookie: customerCookie });
  check('แจ้งเตือน "เติมเงินถูกปฏิเสธ"', r.status === 200 && (r.json?.data ?? []).some((n) => n.title === 'เติมเงินถูกปฏิเสธ'));

  // ---------- 8. ป้องกันการอนุมัติซ้ำ ----------
  r = await api(`/api/admin/topups/${txId}`, { method: 'PATCH', body: { action: 'approve' }, cookie: adminCookie });
  check('อนุมัติซ้ำ → 409', r.status === 409, `HTTP ${r.status}`);

  // ---------- 9. ตรวจ audit log ----------
  r = await api('/api/admin/audit-logs?limit=20', { cookie: adminCookie });
  const audits = r.json?.data ?? [];
  check('audit log มี topup.approve/reject', r.status === 200 && audits.some((a) => a.action === 'topup.approve') && audits.some((a) => a.action === 'topup.reject'), `HTTP ${r.status} นับ=${audits.length}`);

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
