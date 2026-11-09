/**
 * อัปเดตรูปอาหาร/รูปร้านใน Supabase → ใช้รูป AI ที่สร้างไว้ใน /public/food
 * รัน: node scripts/update-images.mjs
 */
const URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_KEY;

const MAP = [
  { name: 'ไก่ทอดหาดใหญ่', img: '/food/fried-chicken.png' },
  { name: 'ซูชิเค ยานนาวา', img: '/food/sushi.png' },
  { name: 'พิซซ่า รัชดา 32', img: '/food/pizza.png' },
  { name: 'ส้มตำนักเดินทาง', img: '/food/som-tam.png' },
  { name: 'ผัดไทยทิพย์สมบัติ', img: '/food/pad-thai.png' },
  { name: 'ต้มยำกุ้ง 77 ตำราแม่', img: '/food/tom-yum.png' },
  { name: 'ข้าวมันไก่เจ๊กเป็น', img: '/food/khao-mun-kai.png' },
  { name: 'ก๋วยเตี๋ยวเรือนอยุธยา', img: '/food/boat-noodle.png' },
];

const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };

async function patch(table, params, body) {
  const qs = new URLSearchParams(params);
  const res = await fetch(`${URL}/rest/v1/${table}?${qs}`, {
    method: 'PATCH',
    headers: { ...H, Prefer: 'return=representation' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${table}: ${res.status} ${await res.text()}`);
  return res.json();
}

const rows = await fetch(`${URL}/rest/v1/restaurants?select=id,name&is_active=eq.true`, { headers: H }).then((r) => r.json());

for (const r of rows) {
  const m = MAP.find((m) => r.name === m.name);
  if (!m) {
    console.log(`skip (ไม่มีในแผนที่): ${r.name}`);
    continue;
  }
  await patch('restaurants', { id: `eq.${r.id}` }, { cover_url: m.img, logo_url: m.img });
  const items = await patch('menu_items', { restaurant_id: `eq.${r.id}` }, { image_url: m.img });
  console.log(`✓ ${r.name} → ${m.img} (เมนู ${items.length} รายการ)`);
}
console.log('เสร็จสิ้น');
