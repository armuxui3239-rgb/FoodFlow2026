// verify-pin-reset-flow.mjs — E2E โฟลว์ลืม PIN ผ่านการอนุมัติแอดมิน (เฟส 6 รอบสอง / v4 ข้อ 4.5)
// รันกับ dev server: node scripts/verify-pin-reset-flow.mjs [baseUrl]
// วงจร: สมัคร+ตั้ง PIN → ลืม PIN (OTP reset_pin) → สร้างคำขอ → ตั้ง PIN ก่อนอนุมัติ = 403
//        → แอดมินอนุมัติ → ตรวจสถานะ = approved → ตั้ง PIN ใหม่สำเร็จ → ล็อกอิน PIN ใหม่
//        → วงจรปฏิเสธ → audit log

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

// IP ทดสอบสุ่มต่อรอบ — กันชนโควตา 10 ครั้ง/ชั่วโมง/IP ของ otp/send
const TEST_IP = `198.19.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250) + 1}`;
const stamp = Date.now().toString().slice(-8);

async function main() {
  console.log(`\n🧪 Verify PIN Reset Flow — ${BASE}\n`);

  // ---------- 1. แอดมิน + ลูกค้าใหม่ (ตั้ง PIN 258025) ----------
  let r = await api('/api/auth/login', { method: 'POST', body: { email: 'admin@foodthunder.co.th', password: 'Food@1234' } });
  const adminCookie = r.cookie;
  check('แอดมินล็อกอิน', r.status === 200 && !!adminCookie);

  const phone = `0995${stamp.slice(-6)}${Math.floor(Math.random() * 9)}`.slice(0, 10);
  r = await api('/api/auth/otp/send', { method: 'POST', body: { phone, email: `rst${stamp}@foodthunder.co.th`, fullName: 'Pin Reset ทดสอบ', purpose: 'register' } });
  r = await api('/api/auth/otp/verify', { method: 'POST', body: { otpId: r.json?.otpId, code: r.json?.devCode } });
  const pcReg = r.cookie;
  await api('/api/auth/onboard/profile', { method: 'POST', body: { fullName: 'Pin Reset ทดสอบ', email: `rst${stamp}@foodthunder.co.th` }, cookie: pcReg });
  await api('/api/auth/onboard/location', { method: 'POST', body: { label: 'บ้าน', addressLine: 'ทดสอบรีเซ็ต PIN 99', lat: 13.765, lng: 100.538 }, cookie: pcReg });
  r = await api('/api/auth/onboard/pin', { method: 'POST', body: { pin: '258025' }, cookie: pcReg });
  check('ลูกค้าใหม่ตั้ง PIN 258025', r.status === 200);

  // ---------- 2. ลืม PIN: OTP reset_pin → สร้างคำขอ ----------
  r = await api('/api/auth/otp/send', { method: 'POST', body: { phone, purpose: 'reset_pin' } });
  check('otp/send (reset_pin)', r.status === 200 && !!r.json?.otpId);
  r = await api('/api/auth/otp/verify', { method: 'POST', body: { otpId: r.json?.otpId, code: r.json?.devCode } });
  const pcReset = r.cookie;
  check('otp/verify → สร้างคำขอ + ส่งไปหน้ารออนุมัติ', r.status === 200 && (r.json?.next ?? '').includes('awaiting=1'), `next=${r.json?.next}`);

  // ---------- 3. พยายามตั้ง PIN ก่อนอนุมัติ → 403 ----------
  r = await api('/api/auth/onboard/pin', { method: 'POST', body: { pin: '135790' }, cookie: pcReset });
  check('ตั้ง PIN ก่อนอนุมัติ → 403 ถูกกัน', r.status === 403, `HTTP ${r.status} ${JSON.stringify(r.json).slice(0, 100)}`);

  // ---------- 4. แอดมินเห็นคำขอ + อนุมัติ ----------
  r = await api('/api/admin/pin-resets', { cookie: adminCookie });
  const reqRow = (r.json?.data ?? []).find((x) => x.users?.phone === phone);
  check('แอดมินเห็นคำขอรออนุมัติ', r.status === 200 && reqRow?.status === 'pending', `HTTP ${r.status} found=${!!reqRow}`);
  r = await api(`/api/admin/pin-resets/${reqRow?.id}`, { method: 'PATCH', body: { action: 'approve' }, cookie: adminCookie });
  check('แอดมินอนุมัติ → approved', r.status === 200 && r.json?.data?.status === 'approved', `HTTP ${r.status}`);

  // ---------- 5. ลูกค้าตรวจสถานะ → ตั้ง PIN ใหม่ → ล็อกอิน ----------
  r = await api('/api/auth/reset-pin/status', { cookie: pcReset });
  check('ตรวจสถานะ = approved', r.status === 200 && r.json?.data?.status === 'approved', `HTTP ${r.status}`);
  r = await api('/api/auth/onboard/pin', { method: 'POST', body: { pin: '135790' }, cookie: pcReset });
  check('ตั้ง PIN ใหม่ 135790 สำเร็จ (หลังอนุมัติ)', r.status === 200, `HTTP ${r.status} ${JSON.stringify(r.json).slice(0, 100)}`);
  r = await api('/api/auth/login-pin', { method: 'POST', body: { phone, pin: '135790' } });
  check('ล็อกอินด้วย PIN ใหม่', r.status === 200 && r.json?.user?.role === 'customer', `HTTP ${r.status}`);
  r = await api('/api/auth/login-pin', { method: 'POST', body: { phone, pin: '258025' } });
  check('PIN เดิมใช้ไม่ได้แล้ว', r.status === 401, `HTTP ${r.status}`);

  // ---------- 6. วงจรปฏิเสธ ----------
  r = await api('/api/auth/otp/send', { method: 'POST', body: { phone, purpose: 'reset_pin' } });
  r = await api('/api/auth/otp/verify', { method: 'POST', body: { otpId: r.json?.otpId, code: r.json?.devCode } });
  check('คำขอที่ 2 สร้างแล้ว', r.status === 200 && (r.json?.next ?? '').includes('awaiting=1'));
  r = await api('/api/admin/pin-resets', { cookie: adminCookie });
  const req2 = (r.json?.data ?? []).find((x) => x.users?.phone === phone && x.status === 'pending');
  r = await api(`/api/admin/pin-resets/${req2?.id}`, { method: 'PATCH', body: { action: 'reject', note: 'ข้อมูลไม่ครบ' }, cookie: adminCookie });
  check('แอดมินปฏิเสธ → rejected', r.status === 200 && r.json?.data?.status === 'rejected', `HTTP ${r.status}`);
  r = await api('/api/auth/onboard/pin', { method: 'POST', body: { pin: '246810' }, cookie: pcReset });
  check('ตั้ง PIN หลังถูกปฏิเสธ → 403', r.status === 403, `HTTP ${r.status}`);

  // ---------- 7. audit ----------
  r = await api('/api/admin/audit-logs?limit=20', { cookie: adminCookie });
  const audits = r.json?.data ?? [];
  check('audit log มี pin_reset.approve/reject', r.status === 200 && audits.some((a) => a.action === 'pin_reset.approve') && audits.some((a) => a.action === 'pin_reset.reject'), `HTTP ${r.status}`);

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
