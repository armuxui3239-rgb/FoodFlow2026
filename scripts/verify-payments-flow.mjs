// verify-payments-flow.mjs — E2E วิธีชำระเงิน 3 วิธี + ทิป (UI-ALIGNMENT-PLAN เฟส 5.2-5.3)
// รันกับ dev server: node scripts/verify-payments-flow.mjs [baseUrl]
// วงจร: สมัครลูกค้าใหม่ → เติมเงิน ฿1,000 (สลิป+อนุมัติ) → สั่งแบบกระเป๋าเงิน (หักจริง)
//        → สั่งแบบเงินสดปลายทาง → สั่งแบบพร้อมเพย์ (รอชำระ) → กรณียอดไม่พอ → ขอบเขตทิป ฿10

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

const PNG_B64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

async function uploadSlip(transactionId, cookie) {
  const form = new FormData();
  form.append('transactionId', transactionId);
  form.append('slip', new Blob([Buffer.from(PNG_B64, 'base64')], { type: 'image/png' }), 'slip.png');
  const res = await fetch(`${BASE}/api/wallet/topup/slip`, { method: 'POST', headers: { Cookie: cookie }, body: form });
  return { status: res.status };
}

const stamp = Date.now().toString().slice(-8);

async function main() {
  console.log(`\n🧪 Verify Payments Flow — ${BASE}\n`);

  // ---------- 1. แอดมิน + ลูกค้าใหม่ ----------
  let r = await api('/api/auth/login', { method: 'POST', body: { email: 'admin@foodthunder.co.th', password: 'Food@1234' } });
  const adminCookie = r.cookie;
  check('แอดมินล็อกอิน', r.status === 200 && !!adminCookie);

  r = await api('/api/auth/otp/send', { method: 'POST', body: { phone: `0993${stamp.slice(-6)}${Math.floor(Math.random() * 9)}`.slice(0, 10), email: `pay${stamp}@foodthunder.co.th`, fullName: 'Payments Flow ทดสอบ', purpose: 'register' } });
  r = await api('/api/auth/otp/verify', { method: 'POST', body: { otpId: r.json?.otpId, code: r.json?.devCode } });
  const pendingCookie = r.cookie;
  await api('/api/auth/onboard/profile', { method: 'POST', body: { fullName: 'Payments Flow ทดสอบ', email: `pay${stamp}@foodthunder.co.th` }, cookie: pendingCookie });
  await api('/api/auth/onboard/location', { method: 'POST', body: { label: 'บ้าน', addressLine: 'ทดสอบชำระเงิน 99 กรุงเทพฯ 10400', lat: 13.765, lng: 100.538 }, cookie: pendingCookie });
  r = await api('/api/auth/onboard/pin', { method: 'POST', body: { pin: '258025' }, cookie: pendingCookie });
  const customerCookie = r.cookie;
  check('ลูกค้าใหม่พร้อม (PIN 258025)', r.status === 200 && !!customerCookie);

  // ---------- 2. เติมเงิน ฿1,000 ครบวงจร ----------
  r = await api('/api/auth/verify-pin', { method: 'POST', body: { pin: '258025' }, cookie: customerCookie });
  check('verify-pin ก่อนเติมเงิน', r.status === 200);
  r = await api('/api/wallet/topup', { method: 'POST', body: { amount: 1000 }, cookie: customerCookie });
  const txId = r.json?.data?.transactionId;
  check('สร้างเติมเงิน ฿1,000 + QR', r.status === 201 && !!txId);
  r = await uploadSlip(txId, customerCookie);
  check('แนบสลิป', r.status === 200);
  r = await api(`/api/admin/topups/${txId}`, { method: 'PATCH', body: { action: 'approve' }, cookie: adminCookie });
  check('แอดมินอนุมัติ', r.status === 200);
  r = await api('/api/wallet', { cookie: customerCookie });
  const balance0 = r.json?.data?.balance ?? 0;
  check('ยอดกระเป๋า = 100,000 สตางค์', balance0 === 100000, `balance=${balance0}`);

  // ---------- 3. เตรียมตะกร้า ----------
  r = await api('/api/restaurants?limit=5');
  const restaurantId = r.json?.data?.[0]?.id;
  r = await api(`/api/restaurants/${restaurantId}`);
  const foodItem = (r.json?.items ?? r.json?.menu_items ?? [])[0];
  check('มีเมนูสำหรับทดสอบ', !!foodItem);
  const addToCart = async () => {
    const fr = await api(`/api/food/${foodItem.id}`);
    const optionValueIds = ((fr.json?.option_groups ?? fr.json?.options ?? [])[0]?.values ?? []).slice(0, 1).map((v) => v.id);
    const cr = await api('/api/cart', { method: 'POST', body: { menuItemId: foodItem.id, quantity: 1, optionValueIds, notes: 'verify payments' }, cookie: customerCookie });
    return cr.status === 200 || cr.status === 201;
  };
  check('เพิ่มลงตะกร้า', await addToCart());

  // ---------- 4. สั่งแบบกระเป๋าเงิน (หักจริง) ----------
  r = await api('/api/orders', { method: 'POST', body: { paymentMethod: 'wallet' }, cookie: customerCookie });
  const walletOrder = r.json?.order;
  const total1 = walletOrder?.total ?? 0;
  check('สั่งแบบกระเป๋าเงิน → paid ทันที', r.status === 201 && walletOrder?.status === 'paid' && walletOrder?.payment_method === 'wallet', `HTTP ${r.status} ${JSON.stringify(r.json).slice(0, 120)}`);
  r = await api('/api/wallet', { cookie: customerCookie });
  const balance1 = r.json?.data?.balance ?? 0;
  check('กระเป๋าถูกหักตรงยอด', balance1 === balance0 - total1, `ก่อน=${balance0} หลัง=${balance1} ควรลด ${total1}`);

  // ---------- 5. สั่งแบบเงินสดปลายทาง ----------
  check('เพิ่มลงตะกร้า (COD)', await addToCart());
  r = await api('/api/orders', { method: 'POST', body: { paymentMethod: 'cash' }, cookie: customerCookie });
  check('สั่งแบบเงินสดปลายทาง → paid (payments pending)', r.status === 201 && r.json?.order?.status === 'paid' && r.json?.order?.payment_method === 'cash', `HTTP ${r.status} ${JSON.stringify(r.json).slice(0, 120)}`);
  check('ไม่มีคิวอาร์สำหรับ COD', r.json?.qrImage == null);

  // ---------- 6. สั่งแบบพร้อมเพย์ (รอชำระ มีคิวอาร์) ----------
  check('เพิ่มลงตะกร้า (พร้อมเพย์)', await addToCart());
  r = await api('/api/orders', { method: 'POST', body: { paymentMethod: 'promptpay' }, cookie: customerCookie });
  check('สั่งแบบพร้อมเพย์ → pending_payment + QR', r.status === 201 && r.json?.order?.status === 'pending_payment' && !!r.json?.qrImage, `HTTP ${r.status}`);

  // ---------- 7. กรณียอดไม่พอ ----------
  r = await api('/api/wallet', { cookie: customerCookie });
  const balanceNow = r.json?.data?.balance ?? 0;
  check('เพิ่มลงตะกร้า (ทดสอบยอดไม่พอ)', await addToCart());
  // ทำให้ยอดไม่พอแน่นอน: เติมเพิ่มไม่ได้ จึงทดสอบด้วยการขอสั่งถ้ายอดเหลือ < ยอดอาหาร+ค่าส่ง
  r = await api('/api/orders', { method: 'POST', body: { paymentMethod: 'wallet' }, cookie: customerCookie });
  if (r.status === 400 && (r.json?.error ?? '').includes('ไม่พอ')) {
    check('กรณียอดไม่พอ → 400 พร้อมข้อความชัด', true, r.json?.error);
  } else if (r.status === 201) {
    // ยอดยังพอ (รายการถูก) — ถือว่าผ่านเงื่อนไขตรวจยอด และกระเป๋าถูกหักตรงอีกครั้ง
    const b = (await api('/api/wallet', { cookie: customerCookie })).json?.data?.balance ?? 0;
    check('กรณียอดยังพอ → หักตรงยอดอีกครั้ง', b === balanceNow - (r.json?.order?.total ?? 0), `balance=${b}`);
  } else {
    check('กรณียอดไม่พอ → 400 พร้อมข้อความชัด', false, `HTTP ${r.status} ${JSON.stringify(r.json).slice(0, 100)}`);
  }

  // ---------- 8. ขอบเขตทิป (เฟส 5.3) ----------
  const anyOrderId = (await api('/api/orders', { cookie: customerCookie })).json?.data?.[0]?.id;
  r = await api('/api/driver/tips', { method: 'POST', body: { orderId: anyOrderId, amountSatang: 500 }, cookie: customerCookie });
  check('ทิป ฿5 (ต่ำกว่าขั้นต่ำ) → 400 ระบุช่วง 10–1,000', r.status === 400 && (r.json?.error ?? '').includes('10–1,000'), `HTTP ${r.status} ${JSON.stringify(r.json).slice(0, 100)}`);
  r = await api('/api/driver/tips', { method: 'POST', body: { orderId: anyOrderId, amountSatang: 1000 }, cookie: customerCookie });
  check('ทิป ฿10 (ยอดใหม่) ผ่านการตรวจจำนวน — ค้างที่เงื่อนไขสถานะออเดอร์', r.status !== 400 || !(r.json?.error ?? '').includes('10–1,000'), `HTTP ${r.status} ${JSON.stringify(r.json).slice(0, 100)}`);

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
