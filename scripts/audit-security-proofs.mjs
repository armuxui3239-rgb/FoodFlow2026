// audit-security-proofs.mjs — พิสูจน์กลไกความปลอดภัย 3 จุด บนระบบจริง (รอบ 4 ฝั่งเอเจนต์)
// 1) cookie ล็อกอินมี Secure/HttpOnly/SameSite จริงบน production
// 2) rate limit ยิงเกินขีด → 429 จริง
// 3) PDPA ลบบัญชีจริง: สมัครใหม่ → ลบ → เข้าระบบอีกไม่ได้ (ปิดบัญชี + ไม่ระบุตัวตน)
// รัน: node scripts/audit-security-proofs.mjs [baseUrl]
const BASE = process.argv[2] || 'http://localhost:3000';
const freshIp = () => `198.23.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250) + 1}`;
let pass = 0;
let fail = 0;
const check = (name, ok, detail = '') => {
  if (ok) { pass++; console.log(`  ✅ ${name}${detail ? ` — ${detail}` : ''}`); }
  else { fail++; console.log(`  ❌ ${name}${detail ? ` — ${detail}` : ''}`); }
};

async function call(path, { method = 'GET', body, cookie, ip = freshIp() } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': ip, ...(cookie ? { Cookie: cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    redirect: 'manual',
  });
  const setCookie = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : [res.headers.get('set-cookie') || ''];
  let json = null;
  try { json = await res.json(); } catch { /* ignore */ }
  return { status: res.status, json, setCookie };
}

console.log(`\n🛡 พิสูจน์ความปลอดภัย 3 จุด — ${BASE}\n`);
const isProd = !/localhost|127\.0\.0\.1/.test(BASE);

// ── 1) cookie Secure/HttpOnly/SameSite ──
console.log(isProd
  ? '1) Cookie ล็อกอิน (production ต้องมี Secure จริง)'
  : '1) Cookie ล็อกอิน (dev บน http — ต้องไม่มี Secure ตามดีไซน์)');
const login = await call('/api/auth/login', { method: 'POST', body: { email: 'admin@foodthunder.co.th', password: 'Food@1234' } });
const sessCookie = login.setCookie.find((c) => c.startsWith('ft_session='));
const hasSecure = sessCookie?.includes('Secure') ?? false;
check('ล็อกอินสำเร็จได้ cookie', !!sessCookie, sessCookie?.split(';')[0]?.slice(0, 30) + '…');
check(isProd ? 'มี flag Secure' : 'ไม่มี flag Secure (dev http — ถูกต้อง)', isProd ? hasSecure : !hasSecure);
check('มี flag HttpOnly', !!sessCookie?.includes('HttpOnly'));
check('มี flag SameSite', !!sessCookie?.includes('SameSite'), sessCookie?.split(';').filter((f) => f.trim().startsWith('SameSite'))[0] ?? '');

// ── 2) rate limit 429 (IP เดียวทั้งชุด — เพื่อชนขีดจริง) ──
console.log('\n2) Rate limit — ยิงล็อกอิน 25 ครั้งติดกันด้วย IP เดียว (เกินขีด 20/นาที/IP)');
const burstIp = freshIp();
let got429 = 0;
const codes = [];
for (let i = 0; i < 25; i++) {
  const r = await call('/api/auth/login', {
    ip: burstIp,
    method: 'POST',
    body: { email: `nosuch-${Math.random().toString(36).slice(2)}@invalid.test`, password: 'WrongPass1!' },
  });
  codes.push(r.status);
  if (r.status === 429) got429++;
}
check(`ยิง 25 ครั้ง → เจอ 429 จริง (${got429} ครั้ง)`, got429 > 0, `รหัสที่ได้: ${codes.slice(0, 10).join(',')}${codes.length > 10 ? '…' : ''}`);

// ── 3) PDPA ลบบัญชีจริง (รอโควตา IP คืนก่อน — บน Vercel บังคับใช้ IP จริง ปลอมไม่ได้) ──
console.log('\n3) PDPA ลบบัญชีจริง — สมัครใหม่ → ลบ → เข้าระบบอีกไม่ได้');
if (isProd) {
  console.log('  ⏳ รอ 70 วินาที ให้ขีดจำกัดต่อ IP รีเซ็ต (ผลของข้อ 2 ยิงเกินขีดไว้ตั้งใจ)');
  await new Promise((r) => setTimeout(r, 70000));
}
const stamp = Date.now().toString().slice(-8);
const phone = `091${stamp}`.slice(0, 10);
const email = `pdpa${stamp}@foodthunder.co.th`;
let r = await call('/api/auth/otp/send', { method: 'POST', body: { phone, email, fullName: 'ทดสอบ PDPA', purpose: 'register' } });
const otpId = r.json?.otpId;
const devCode = r.json?.devCode;
check('otp/send (รหัสสร้างในระบบ)', r.status === 200 && !!devCode, `HTTP ${r.status}`);
r = await call('/api/auth/otp/verify', { method: 'POST', body: { otpId, code: devCode } });
const pcCookie = r.setCookie.find((c) => c.startsWith('ft_pending='));
check('otp/verify + ได้ cookie รอยืนยัน', r.status === 200 && !!pcCookie, `HTTP ${r.status}`);
r = await call('/api/auth/onboard/profile', { method: 'POST', body: { fullName: 'ทดสอบ PDPA', email }, cookie: pcCookie });
check('onboard/profile', r.status === 200 || r.status === 201, `HTTP ${r.status}`);
r = await call('/api/auth/onboard/location', { method: 'POST', body: { label: 'บ้าน', addressLine: 'PDPA ทดสอบ 1', lat: 13.765, lng: 100.538 }, cookie: pcCookie });
check('onboard/location', r.status === 200 || r.status === 201, `HTTP ${r.status}`);
await call('/api/auth/onboard/pin', { method: 'POST', body: { pin: '258025' }, cookie: pcCookie });
r = await call('/api/auth/onboard/pin', { method: 'POST', body: { pin: '258025' }, cookie: pcCookie });
const custCookie = r.setCookie.find((c) => c.startsWith('ft_session='));
check('onboard/pin (ใช้งานได้ + ได้ session)', r.status === 200 && !!custCookie, `HTTP ${r.status}`);
r = await call('/api/auth/delete-account', { method: 'POST', cookie: custCookie });
check('ลบบัญชีสำเร็จ (anonymize + ปิดบัญชี)', r.status === 200, `HTTP ${r.status} ${JSON.stringify(r.json).slice(0, 80)}`);
r = await call('/api/auth/login-pin', { method: 'POST', body: { phone, pin: '258025' } });
check('ล็อกอินด้วยเบอร์+PIN เดิมหลังลบ → ไม่สำเร็จ', r.status !== 200, `HTTP ${r.status}`);

console.log(`\n📊 สรุป: ผ่าน ${pass} / ไม่ผ่าน ${fail}`);
if (fail > 0) process.exit(1);
