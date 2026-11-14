// verify-restaurant-bank.mjs — E2E บัญชีธนาคารรับรายได้ร้าน + โอนรายได้ร้าน
// รันกับ dev server: node scripts/verify-restaurant-bank.mjs [baseUrl]

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
  return all.map((c) => c.split(';')[0]).find((c) => c.startsWith('ft_session=')) || '';
}

async function api(path, { method = 'GET', body, cookie } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await res.json(); } catch { /* ignore */ }
  return { status: res.status, json, cookie: cookieOf(res) };
}

async function main() {
  console.log(`\n🧪 Verify บัญชีธนาคารร้าน + โอนรายได้ร้าน — ${BASE}\n`);

  // ---------- ล็อกอิน ----------
  let r = await api('/api/auth/login', { method: 'POST', body: { email: 'restaurant1@foodthunder.co.th', password: 'Food@1234' } });
  const ownerCookie = r.cookie;
  check('เจ้าของร้านล็อกอิน', r.status === 200);
  r = await api('/api/auth/login', { method: 'POST', body: { email: 'admin@foodthunder.co.th', password: 'Food@1234' } });
  const adminCookie = r.cookie;
  check('แอดมินล็อกอิน', r.status === 200);

  // ---------- บัญชีธนาคารร้าน (เจ้าของจัดการเอง) ----------
  console.log('\nA) บัญชีธนาคารรับรายได้ (เจ้าของจัดการเอง)');
  r = await api('/api/owner/bank', { cookie: ownerCookie });
  check('GET บัญชีเริ่มต้น', r.status === 200, `HTTP ${r.status}`);
  r = await api('/api/owner/bank', { method: 'PATCH', body: { bankName: 'ธนาคารกรุงเทพ', accountNumber: '1234567890', holderName: 'ร้านตัวอย่าง จำกัด' }, cookie: ownerCookie });
  check('PATCH บัญชีใหม่', r.status === 200 && r.json?.data?.bank_name === 'ธนาคารกรุงเทพ', `HTTP ${r.status}`);
  r = await api('/api/owner/bank', { method: 'PATCH', body: { bankName: 'ธนาคารกรุงเทพ', accountNumber: '12', holderName: 'ร้านตัวอย่าง จำกัด' }, cookie: ownerCookie });
  check('เลขบัญชีสั้นเกิน → 400', r.status === 400, `HTTP ${r.status}`);
  r = await api('/api/owner/bank', { cookie: ownerCookie });
  check('GET ยืนยันบันทึกจริง', r.status === 200 && r.json?.data?.bank_account_number === '1234567890');

  // ---------- แอดมินเห็นบัญชีร้าน ----------
  console.log('\nB) แอดมินเห็นบัญชีร้าน (ผ่าน GET รายละเอียด)');
  r = await api('/api/admin/restaurants?limit=50', { cookie: adminCookie });
  const list = r.json?.data ?? r.json?.restaurants ?? [];
  check('รายการร้าน', r.status === 200 && list.length > 0, `HTTP ${r.status} นับ=${list.length}`);
  let restaurantId = null;
  for (const item of list) {
    const detail = await api(`/api/admin/restaurants/${item.id}`, { cookie: adminCookie });
    const owners = detail.json?.owners ?? [];
    if (owners.some((o) => o.user?.email === 'restaurant1@foodthunder.co.th')) {
      restaurantId = item.id;
      check('พบร้านของ restaurant1', true);
      check('แอดมินเห็นเลขบัญชีที่ร้านบันทึกไว้', detail.json?.restaurant?.bank_account_number === '1234567890');
      break;
    }
  }
  check('พบร้านเป้าหมาย', !!restaurantId, 'ไม่พบร้านที่ผูกกับ restaurant1');

  // ---------- โอนรายได้ให้ร้าน ----------
  console.log('\nC) โอนรายได้ให้ร้าน (แอดมินบันทึก + ยืนยันโอน)');
  r = await api(`/api/admin/restaurants/${restaurantId}/payouts`, { method: 'POST', body: { amountSatang: 85000 }, cookie: adminCookie });
  check('บันทึกโอน ฿850 → pending', r.status === 201 && r.json?.data?.status === 'pending', `HTTP ${r.status}`);
  const payoutId = r.json?.data?.id;
  r = await api('/api/owner/payouts', { cookie: ownerCookie });
  check('ร้านเห็นประวัติโอนของตัวเอง', r.status === 200 && (r.json?.data ?? []).some((p) => p.id === payoutId));
  r = await api(`/api/admin/payouts/${payoutId}`, { method: 'PATCH', body: {}, cookie: adminCookie });
  check('ยืนยันโอน → settled', r.status === 200 && r.json?.data?.status === 'settled', `HTTP ${r.status}`);
  r = await api('/api/owner/payouts', { cookie: ownerCookie });
  check('ร้านเห็นสถานะโอนแล้ว', (r.json?.data ?? []).some((p) => p.id === payoutId && p.status === 'settled'));
  r = await api(`/api/admin/payouts/${payoutId}`, { method: 'PATCH', body: {}, cookie: adminCookie });
  check('ยืนยันซ้ำ → 409', r.status === 409, `HTTP ${r.status}`);

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
