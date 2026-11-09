/**
 * แปลงผล image-search → URL ต่อเมนู (map ตาม "ชื่อร้าน") แล้ว PATCH ลง Supabase
 * รัน: cd /home/z/my-project && set -a && source .env && set +a && node scripts/apply-images.mjs
 */
import { readFileSync } from 'node:fs';

const URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_KEY;
const DIR = '/home/z/imgsearch';

const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', Prefer: 'return=representation' };

function load(key) {
  try {
    const raw = readFileSync(`${DIR}/${key}.json`, 'utf8');
    // CLI พิมพ์บรรทัดหัว ("🚀...", "🔎...") ก่อน JSON — ตัดเอาเฉพาะช่วง { ... }
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start < 0 || end <= start) return [];
    const j = JSON.parse(raw.slice(start, end + 1));
    if (!j.success) return [];
    return (j.results ?? []).map((r) => r.original_url).filter(Boolean);
  } catch {
    return [];
  }
}

const IMG = Object.fromEntries([
  'kaimun', 'kaitod', 'somtam', 'tomyum', 'padthai', 'boatnoodle',
  'pizza', 'sushi', 'thaitea', 'gaengsom', 'jasminerice', 'coconut',
  'stirnoodle', 'friedpork', 'cola', 'grillchicken', 'stickyrice', 'larb',
  'fries', 'nigiri', 'gyoza', 'matcha', 'wings', 'oj', 'clearsoup',
  'morningglory', 'braisedbeef', 'hawaiianpizza', 'pepperoni',
].map((k) => [k, load(k)]));

// หยิบรูปที่-i ของชุดแรกที่มีรูปตามจำนวนนั้น
const pick = (...cands) => {
  for (const [k, i] of cands) if (IMG[k]?.[i]) return IMG[k][i];
  return '/food/fried-chicken.png';
};

// map ตามชื่อร้าน (กันเรื่องลำดับ rating เปลี่ยน)
const BY_NAME = {
  'ข้าวมันไก่เจ๊กเป็น': [
    pick(['kaimun', 0]), // ข้าวมันไก่ไข่ดอง
    pick(['kaimun', 1]), // ข้าวมันไก่ทอด
    pick(['kaimun', 2]), // ไก่ต้มน้ำปลา (พิเศษ)
    pick(['clearsoup', 0], ['tomyum', 3]), // ซุปใส่เครื่องใน
    pick(['thaitea', 0], ['coconut', 1]), // ชาเย็นโบราณ
  ],
  'ต้มยำกุ้ง 77 ตำราแม่': [
    pick(['tomyum', 0]), // ต้มยำกุ้งน้ำข้น (เดี่ยว)
    pick(['tomyum', 1]), // ต้มยำปลาช่อน (เดี่ยว)
    pick(['gaengsom', 0], ['tomyum', 2]), // แกงส้มชะอมไข่ปลา
    pick(['jasminerice', 0]), // ข้าวสวย
    pick(['coconut', 0]), // น้ำมะพร้าวแก้ว
  ],
  'ผัดไทยทิพย์สมบัติ': [
    pick(['padthai', 0]), // ผัดไทยกุ้งสด
    pick(['padthai', 1]), // ผัดไทยห่อไข่
    pick(['stirnoodle', 0], ['padthai', 2]), // ก๋วยเตี๋ยวคั่วไก่
    pick(['friedpork', 0], ['kaitod', 3]), // ปอดทอดกรอบ
    pick(['cola', 0], ['coconut', 1]), // น้ำอัดลมไทย
  ],
  'ส้มตำนักเดินทาง': [
    pick(['somtam', 0]), // ส้มตำปูปลาร้า
    pick(['somtam', 1]), // ส้มตำไทย
    pick(['grillchicken', 0], ['kaitod', 1]), // ไก่ย่างขมิ้น
    pick(['stickyrice', 0], ['jasminerice', 1]), // ข้าวเหนียวนึ่ง
    pick(['larb', 0], ['somtam', 2]), // ลาบหมู
  ],
  'พิซซ่า รัชดา 32': [
    pick(['pizza', 0]), // มาร์เกอริต้า
    pick(['pepperoni', 0], ['pizza', 1]), // เปปเปอโรนี
    pick(['hawaiianpizza', 0], ['pizza', 2]), // ฮาวายเอียน
    pick(['fries', 0], ['kaitod', 2]), // เฟรนช์ฟราย
    pick(['cola', 1], ['coconut', 1]), // โค้กแก้วใหญ่
  ],
  'ซูชิเค ยานนาวา': [
    pick(['sushi', 0]), // ซาลม่อนโรล
    pick(['sushi', 1]), // คาลิฟอร์เนียโรล
    pick(['nigiri', 0], ['sushi', 2]), // ไข่ปลากุนิง (2 ชิ้น)
    pick(['gyoza', 0], ['sushi', 3]), // เกี๊ยวซ่าทอด
    pick(['matcha', 0], ['thaitea', 1]), // มัทฉะลาเต้
  ],
  'ไก่ทอดหาดใหญ่': [
    pick(['kaitod', 0]), // ไก่ทอดหาดใหญ่ (ชิ้นใหญ่)
    pick(['kaitod', 1]), // ไก่ทอด 3 ชิ้น + ข้าวเหนียว
    pick(['wings', 0], ['kaitod', 2]), // ปีกไก่ทอด (6 ชิ้น)
    pick(['fries', 1], ['kaitod', 3]), // เฟรนช์ฟรายใหญ่
    pick(['oj', 0], ['coconut', 1]), // น้ำส้มคั้นสด
  ],
  'ก๋วยเตี๋ยวเรือนอยุธยา': [
    pick(['boatnoodle', 0]), // ก๋วยเตี๋ยวเรือนต้มยำ
    pick(['boatnoodle', 1]), // ก๋วยเตี๋ยวเรือนน้ำใส
    pick(['braisedbeef', 0], ['boatnoodle', 2]), // เนื้อนุ่มพิเศษ
    pick(['morningglory', 0], ['somtam', 3]), // ผักบุ้งลวก
    pick(['cola', 2], ['coconut', 1]), // น้ำอัดลมโบราณ
  ],
};

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
console.log(`พบร้าน ${rows.length} ร้าน`);

for (const r of rows) {
  const imgs = BY_NAME[r.name];
  if (!imgs) {
    console.log(`skip (ไม่มีในแผนที่): ${r.name}`);
    continue;
  }
  const items = await fetch(`${URL}/rest/v1/menu_items?restaurant_id=eq.${r.id}&select=id,name&order=sort_order.asc.nullslast`, { headers: H }).then((x) => x.json());
  let n = 0;
  for (let i = 0; i < items.length; i++) {
    const img = imgs[i % imgs.length];
    if (!img) continue;
    await patch('menu_items', { id: `eq.${items[i].id}` }, { image_url: img });
    n++;
  }
  console.log(`✓ ${r.name}: อัปเดตรูป ${n} เมนู`);
}
console.log('เสร็จสิ้น');
