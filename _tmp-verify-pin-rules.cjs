const BASE = 'http://localhost:3000';
const stamp = Date.now().toString().slice(-8);
function cookieOf(res) {
  const all = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : [res.headers.get('set-cookie') || ''];
  return all.map((c) => c.split(';')[0]).find((c) => c.startsWith('ft_')) || '';
}
async function api(path, { method = 'GET', body, cookie } = {}) {
  const res = await fetch(BASE + path, { method, headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '198.18.9.9', ...(cookie ? { Cookie: cookie } : {}) }, body: body ? JSON.stringify(body) : undefined });
  let json = null; try { json = await res.json(); } catch {}
  return { status: res.status, json, cookie: cookieOf(res) };
}
(async () => {
  const phone = `098${stamp}${Math.floor(Math.random() * 9)}`.slice(0, 10);
  let r = await api('/api/auth/otp/send', { method: 'POST', body: { phone, email: `rule${stamp}@foodthunder.co.th`, fullName: 'Rule Check', purpose: 'register' } });
  r = await api('/api/auth/otp/verify', { method: 'POST', body: { otpId: r.json?.otpId, code: r.json?.devCode } });
  const pc = r.cookie;
  await api('/api/auth/onboard/profile', { method: 'POST', body: { fullName: 'Rule Check', email: `rule${stamp}@foodthunder.co.th`, birthDate: '1999-01-15' }, cookie: pc });
  r = await api('/api/auth/onboard/pin', { method: 'POST', body: { pin: '150199' }, cookie: pc });
  console.log('PIN วันเกิด 150199 →', r.status, r.json?.error ?? '(ผ่าน)');
  r = await api('/api/auth/onboard/pin', { method: 'POST', body: { pin: '123456' }, cookie: pc });
  console.log('PIN เรียง 123456 →', r.status, r.json?.error ?? '(ผ่าน)');
  r = await api('/api/auth/onboard/pin', { method: 'POST', body: { pin: '654321' }, cookie: pc });
  console.log('PIN เรียง 654321 →', r.status, r.json?.error ?? '(ผ่าน)');
  r = await api('/api/auth/onboard/pin', { method: 'POST', body: { pin: '258025' }, cookie: pc });
  console.log('PIN ปกติ 258025 →', r.status);
  const cc = r.cookie;
  r = await api('/api/auth/change-pin', { method: 'POST', body: { oldPin: '999999', newPin: '135790' }, cookie: cc });
  console.log('เปลี่ยน PIN ด้วย PIN เดิมผิด →', r.status, r.json?.error ?? '');
  r = await api('/api/auth/change-pin', { method: 'POST', body: { oldPin: '258025', newPin: '111111' }, cookie: cc });
  console.log('เปลี่ยนเป็นเลขซ้ำ →', r.status, r.json?.error ?? '');
  r = await api('/api/auth/change-pin', { method: 'POST', body: { oldPin: '258025', newPin: '135790' }, cookie: cc });
  console.log('เปลี่ยน PIN ถูกต้อง →', r.status, r.json?.ok ?? '');
  r = await api('/api/auth/login-pin', { method: 'POST', body: { phone, pin: '135790' } });
  console.log('ล็อกอินด้วย PIN ใหม่ →', r.status, r.json?.user?.role ?? r.json?.error);
  // ETA: สั่งพร้อมเพย์ 1 ใบ แล้วดู tracking
  await api('/api/restaurants?limit=5');
  const rs = (await api('/api/restaurants?limit=5')).json?.data?.[0]?.id;
  const fi = (await api(`/api/restaurants/${rs}`)).json?.items?.[0];
  await api('/api/cart', { method: 'POST', body: { menuItemId: fi.id, quantity: 1, optionValueIds: [] }, cookie: cc });
  const ord = (await api('/api/orders', { method: 'POST', body: { paymentMethod: 'cash' }, cookie: cc })).json?.order;
  r = await api(`/api/orders/${ord.id}/tracking`, { cookie: cc });
  console.log('tracking eta →', JSON.stringify(r.json?.data?.eta));
})();
