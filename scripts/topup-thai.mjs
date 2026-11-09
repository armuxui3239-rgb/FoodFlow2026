/**
 * เติมหมวดให้ครบ 4 หมวด/ร้าน และเมนูให้ครบ 5 เมนู/ร้าน (ตามชุดเมนูไทย)
 * รัน: cd /home/z/my-project && set -a && source .env && set +a && node scripts/topup-thai.mjs
 */
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

const URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_KEY;
const DIR = '/home/z/imgsearch';

const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', Prefer: 'return=representation' };

function load(key) {
  try {
    const raw = readFileSync(`${DIR}/${key}.json`, 'utf8');
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

const pick = (...cands) => {
  for (const [k, i] of cands) if (IMG[k]?.[i]) return IMG[k][i];
  return '/food/fried-chicken.png';
};

// [ชื่อ, คำอธิบาย, ราคา, หมวด(0-3), รูป]
const BY_NAME = {
  'ข้าวมันไก่เจ๊กเป็น': [
    ['ข้าวมันไก่ไข่ดอง', 'ไก่นุ่มบนข้าวมันหอม พร้อมไข่ดองและน้ำจิ้มขิง', 65, 0, pick(['kaimun', 0])],
    ['ข้าวมันไก่ทอด', 'ไก่ทอดกรอบบนข้าวมัน ทานคู่น้ำมะนาวแซ่บ', 70, 1, pick(['kaimun', 1])],
    ['ไก่ต้มน้ำปลา (พิเศษ)', 'ส่วนพิเศษไก่ต้มนุ่ม ราดน้ำปลาหอม ๆ', 90, 1, pick(['kaimun', 2])],
    ['ซุปใส่เครื่องใน', 'ซุปใสร้อน ๆ พร้อมเครื่องในไก่', 30, 2, pick(['clearsoup', 0], ['tomyum', 3])],
    ['ชาเย็นโบราณ', 'ชาเย็นเข้มข้นหวานมันกำลังดี', 25, 3, pick(['thaitea', 0], ['coconut', 1])],
  ],
  'ต้มยำกุ้ง 77 ตำราแม่': [
    ['ต้มยำกุ้งน้ำข้น (เดี่ยว)', 'กุ้งแม่น้ำใหญ่ เห็ดฟาง ตะไคร้ ใบมะกรูด', 180, 0, pick(['tomyum', 0])],
    ['ต้มยำปลาช่อน (เดี่ยว)', 'ปลาช่อนสด เผ็ดแซ่บน้ำข้น', 150, 1, pick(['tomyum', 1])],
    ['แกงส้มชะอมไข่ปลา', 'แกงส้มรสจัดจ้าน ชะอมกรอบ ไข่ปลาเค็มมัน', 120, 1, pick(['gaengsom', 0], ['tomyum', 2])],
    ['ข้าวสวย', 'ข้าวหอมมะลินึ่งร้อน', 15, 2, pick(['jasminerice', 0])],
    ['น้ำมะพร้าวแก้ว', 'มะพร้าวอ่อนหวานฉ่ำ', 45, 3, pick(['coconut', 0])],
  ],
  'ผัดไทยทิพย์สมบัติ': [
    ['ผัดไทยกุ้งสด', 'กุ้งสดเนื้อแน่น ไข่ใหญ่ ถั่วงอกสด สูตรดัง 40 ปี', 120, 0, pick(['padthai', 0])],
    ['ผัดไทยห่อไข่', 'ผัดไทยห่อไข่ทองบาง ราดซอสเข้มข้น', 100, 1, pick(['padthai', 1])],
    ['ก๋วยเตี๋ยวคั่วไก่', 'เส้นก๋วยเตี๋ยวคั่วราดไก่มัน หอมน้ำมันเจียว', 80, 1, pick(['stirnoodle', 0], ['padthai', 2])],
    ['ปอดทอดกรอบ', 'ปอดทอดกรอบนอก ชุ่มฉ่ำข้างใน พร้อมน้ำจิ้ม', 60, 2, pick(['friedpork', 0], ['kaitod', 3])],
    ['น้ำอัดลมไทย', 'อัดลมคลาสสิกแก้วใหญ่', 25, 3, pick(['cola', 0], ['coconut', 1])],
  ],
  'ส้มตำนักเดินทาง': [
    ['ส้มตำปูปลาร้า', 'ตำรสแซ่บจัด ปูนาเค็มมัน ปลาร้าหอมแท้', 70, 0, pick(['somtam', 0])],
    ['ส้มตำไทย', 'รสกลมกล่อมหวานเปรี้ยว เผ็ดน้อย', 60, 1, pick(['somtam', 1])],
    ['ไก่ย่างขมิ้น', 'ไก่ย่างไฟอ่อนหมักขมิ้น หอมนุ่มฉ่ำ', 90, 1, pick(['grillchicken', 0], ['kaitod', 1])],
    ['ข้าวเหนียวนึ่ง', 'ข้าวเหนียวนุ่มร้อน ๆ ในตะกร้า', 15, 2, pick(['stickyrice', 0], ['jasminerice', 1])],
    ['ลาบหมู', 'หมูสับคั่วแป้ง รสแซ่บจัด ขมิ้นอ่อน', 75, 2, pick(['larb', 0], ['somtam', 2])],
  ],
  'พิซซ่า รัชดา 32': [
    ['มาร์เกอริต้า', 'ซอสมะเขือเทศอิตาเลียน มอสซาเรลล่า ใบโหระพา', 220, 0, pick(['pizza', 0])],
    ['เปปเปอโรนี', 'เปปเปอโรนีเผ็ด ๆ ชีสยืดเยิ้มเต็มจาน', 250, 1, pick(['pepperoni', 0], ['pizza', 1])],
    ['ฮาวายเอียน', 'แฮมและสับปะรดสด รสกลมกล่อม', 240, 1, pick(['hawaiianpizza', 0], ['pizza', 2])],
    ['เฟรนช์ฟราย', 'มันฝรั่งทอดกรอบพร้อมซอส', 70, 2, pick(['fries', 0], ['kaitod', 2])],
    ['โค้กแก้วใหญ่', 'เย็นฉ่ำพร้อมน้ำแข็ง', 35, 3, pick(['cola', 1], ['coconut', 1])],
  ],
  'ซูชิเค ยานนาวา': [
    ['ซาลม่อนโรล', 'แซลมอนสดหนา ครีมชีส อะโวคาโด', 160, 0, pick(['sushi', 0])],
    ['คาลิฟอร์เนียโรล', 'ปูอัด แตงกวา ไข่ปลาสีส้ม', 120, 1, pick(['sushi', 1])],
    ['ไข่ปลากุนิง (2 ชิ้น)', 'นิกิริไข่ปลาแซลมอนรสเค็มมัน', 90, 1, pick(['nigiri', 0], ['sushi', 2])],
    ['เกี๊ยวซ่าทอด', 'เกี๊ยวซ่ากรอบนอก ฉ่ำข้างใน 4 ชิ้น', 80, 2, pick(['gyoza', 0], ['sushi', 3])],
    ['มัทฉะลาเต้', 'ชาเขียวเข้มข้นผสมนมสด', 65, 3, pick(['matcha', 0], ['thaitea', 1])],
  ],
  'ไก่ทอดหาดใหญ่': [
    ['ไก่ทอดหาดใหญ่ (ชิ้นใหญ่)', 'ไก่ทอดกรอบ หมักเครื่องเทศสูตรลับ', 55, 0, pick(['kaitod', 0])],
    ['ไก่ทอด 3 ชิ้น + ข้าวเหนียว', 'ชุดคุ้มค่า ไก่ร้อน ๆ กับข้าวเหนียวนุ่ม', 89, 1, pick(['kaitod', 1])],
    ['ปีกไก่ทอด (6 ชิ้น)', 'ปีกกรอบราดซอสหวานเผ็ด', 99, 1, pick(['wings', 0], ['kaitod', 2])],
    ['เฟรนช์ฟรายใหญ่', 'มันทอดกรอบนอกนุ่มใน', 45, 2, pick(['fries', 1], ['kaitod', 3])],
    ['น้ำส้มคั้นสด', 'ส้มสายน้ำผึ้งคั้นสด 100%', 40, 3, pick(['oj', 0], ['coconut', 1])],
  ],
  'ก๋วยเตี๋ยวเรือนอยุธยา': [
    ['ก๋วยเตี๋ยวเรือนต้มยำ', 'เส้นเล็กต้มยำเข้มข้น เนื้อนุ่ม ลูกชิ้นปลา', 60, 0, pick(['boatnoodle', 0])],
    ['ก๋วยเตี๋ยวเรือนน้ำใส', 'น้ำซุปกระฉิ่น เครื่องแน่น', 55, 1, pick(['boatnoodle', 1])],
    ['เนื้อนุ่มพิเศษ', 'เพิ่มเนื้อนุ่มพิเศษอีกชิ้น', 35, 2, pick(['braisedbeef', 0], ['boatnoodle', 2])],
    ['ผักบุ้งลวก', 'ผักสดลวกร้อน พร้อมน้ำจิ้มแจ่ว', 20, 2, pick(['morningglory', 0], ['somtam', 3])],
    ['น้ำอัดลมโบราณ', 'อัดลมใส่น้ำแข็งเย็นเจี๊ยบ', 20, 3, pick(['cola', 2], ['coconut', 1])],
  ],
};

const CAT_NAMES = ['เมนูแนะนำ', 'จานหลัก', 'ของทานเล่น', 'เครื่องดื่ม'];

async function req(path, method, body) {
  const res = await fetch(`${URL}/rest/v1/${path}`, {
    method,
    headers: { ...H, Prefer: 'return=representation' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${path}: ${res.status} ${await res.text()}`);
  return res.json();
}

const rests = await req('restaurants?select=id,name&is_active=eq.true', 'GET');
for (const r of rests) {
  const spec = BY_NAME[r.name];
  if (!spec) { console.log(`skip: ${r.name}`); continue; }

  // 1) หมวดให้ครบ 4
  let cats = await req(`categories?restaurant_id=eq.${r.id}&select=id,name&order=sort_order.asc.nullslast`, 'GET');
  for (let c = 0; c < CAT_NAMES.length; c++) {
    const found = cats.find((x) => x.name === CAT_NAMES[c]);
    if (found) continue;
    const created = await req('categories', 'POST', { id: randomUUID(), restaurant_id: r.id, name: CAT_NAMES[c], sort_order: c, is_visible: true });
    cats.push(created[0]);
    console.log(`  + หมวด: ${CAT_NAMES[c]}`);
  }
  cats = await req(`categories?restaurant_id=eq.${r.id}&select=id,name&order=sort_order.asc.nullslast`, 'GET');

  // 2) เมนูให้ครบ 5 (เพิ่มเฉพาะที่ขาด — อิงชื่อ)
  const items = await req(`menu_items?restaurant_id=eq.${r.id}&select=id,name&order=sort_order.asc.nullslast`, 'GET');
  let added = 0;
  for (let i = 0; i < spec.length; i++) {
    const [name, desc, price, catIdx, img] = spec[i];
    if (items.some((x) => x.name === name)) continue;
    const cat = cats.find((x) => x.name === CAT_NAMES[catIdx]) ?? cats[catIdx] ?? cats[0];
    await req('menu_items', 'POST', {
      id: randomUUID(),
      restaurant_id: r.id,
      category_id: cat?.id ?? null,
      name, description: desc, base_price: price, image_url: img,
      is_available: true, is_popular: i < 2, sort_order: i,
    });
    added++;
  }
  console.log(`✓ ${r.name}: เพิ่มเมนู ${added} (รวม ${items.length + added})`);
}
console.log('เสร็จสิ้น');
