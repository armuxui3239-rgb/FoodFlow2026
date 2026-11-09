// Seed Thai data — renames restaurants/categories/menu_items to Thai (Food Thunder)
const URL = 'https://lgjwrxrhbksdbzorcwwb.supabase.co/rest/v1';
const KEY = process.env.SBK;
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', Prefer: 'return=representation' };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function req(t, q, method, body) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const url = `${URL}/${t}?${new URLSearchParams(q)}`;
    const r = await fetch(url, { method: method ?? 'GET', headers: H, body: body ? JSON.stringify(body) : undefined });
    const text = await r.text();
    if (r.ok) { await sleep(80); return text ? JSON.parse(text) : []; }
    console.error(`! ${r.status} ${t} ${attempt + 1}/3: ${text.slice(0, 120)}`);
    if (r.status === 401 || r.status === 403) process.exit(1);
    await sleep(1500 * (attempt + 1));
  }
  throw new Error(`ล้มเหลวถาวร: ${t}`);
}
const get = (t, q) => req(t, q);
const patch = (t, q, body) => req(t, q, 'PATCH', body);

const RESTAURANTS = [
  { name: 'ข้าวมันไก่เจ๊กเป็น', desc: 'ข้าวมันไก่ต้มตำรับจีน ไก่นุ่ม ข้าวหอมมัน เครื่องจิ้มน้ำมะนาวแซ่บ', addr: '432 ถ.เยาวราช แขวงสัมพันธวงศ์', city: 'กรุงเทพมหานคร', district: 'สัมพันธวงศ์', phone: '026225123', cuisines: ['ข้าวมันไก่', 'อาหารจีน'], price: '$' },
  { name: 'ต้มยำกุ้ง 77 ตำราแม่', desc: 'ต้มยำกุ้งน้ำข้นตำราแม่ กุ้งแม่น้ำใหญ่ เผ็ดร้อนแบบไทยแท้', addr: '77 ถ.เจริญกรุง แขวงบางรัก', city: 'กรุงเทพมหานคร', district: 'บางรัก', phone: '026234770', cuisines: ['อาหารไทย', 'ต้มยำ'], price: '$$' },
  { name: 'ผัดไทยทิพย์สมบัติ', desc: 'ผัดไทยกุ้งสดไข่ใหญ่ เส้นยืดหยุ่น รสกลมกล่อมสูตรดัง 40 ปี', addr: '12 ซ.ประดับพณิชยการ แขวงดินสอ', city: 'กรุงเทพมหานคร', district: 'พระนคร', phone: '022214455', cuisines: ['ผัดไทย', 'ก๋วยเตี๋ยว'], price: '$' },
  { name: 'ส้มตำนักเดินทาง', desc: 'ส้มตำปูปลาร้าแซ่บถึงใจ ข้างคู่ไก่ย่าง ข้าวเหนียวนุ่มร้อน ๆ', addr: '88 ถ.พระราม 4 แขวงวังใหม่', city: 'กรุงเทพมหานคร', district: 'ปทุมวัน', phone: '0891234567', cuisines: ['อาหารอีสาน', 'ส้มตำ'], price: '$' },
  { name: 'พิซซ่า รัชดา 32', desc: 'พิซซ่าเตาฟืนแป้งบางกรอบ ชีสยืดเยิ้ม ขอบทองหอมกรุ่น', addr: '32 ถ.รัชดาภิเษก แขวงดินแดง', city: 'กรุงเทพมหานคร', district: 'ดินแดง', phone: '026643210', cuisines: ['พิซซ่า', 'อิตาเลียน'], price: '$$' },
  { name: 'ซูชิเค ยานนาวา', desc: 'ซูชิสดใหม่ทุกวัน ปลาคัดพิเศษ ราคาเป็นมิตร', addr: '1091/9 ถ.พระราม 3 แขวงช่องนนทรี', city: 'กรุงเทพมหานคร', district: 'ยานนาวา', phone: '026831999', cuisines: ['ซูชิ', 'อาหารญี่ปุ่น'], price: '$$' },
  { name: 'ไก่ทอดหาดใหญ่', desc: 'ไก่ทอดกรอบนอกนุ่มใน เครื่องเทศสูตรหาดใหญ่ ทานคู่ข้าวเหนียว', addr: '55 ถ.เพชรบุรีตัดใหม่ แขวงมักกะสัน', city: 'กรุงเทพมหานคร', district: 'ราชเทวี', phone: '0817778889', cuisines: ['ไก่ทอด', 'ฟาสต์ฟู้ด'], price: '$' },
  { name: 'ก๋วยเตี๋ยวเรือนอยุธยา', desc: 'ก๋วยเตี๋ยวเรือนต้มยำเข้มข้น เนื้อนุ่ม น้ำซุปกระฉิ่น สูตรอยุธยาแท้', addr: '9 ถ.หลวงพ่อแก้ว แขวงตลาดน้อย', city: 'กรุงเทพมหานคร', district: 'ไชยวัฒนาราม', phone: '029887766', cuisines: ['ก๋วยเตี๋ยวเรือน', 'อาหารไทย'], price: '$' },
];

const DISHES = [
  [['ข้าวมันไก่ไข่ดอง', 'ไก่นุ่มบนข้าวมันหอม พร้อมไข่ดองและน้ำจิ้มขิง', 65], ['ข้าวมันไก่ทอด', 'ไก่ทอดกรอบบนข้าวมัน ทานคู่น้ำมะนาวแซ่บ', 70], ['ไก่ต้มน้ำปลา (พิเศษ)', 'ส่วนพิเศษไก่ต้มนุ่ม ราดน้ำปลาหอม ๆ', 90], ['ซุปใส่เครื่องใน', 'ซุปใสร้อน ๆ พร้อมเครื่องในไก่', 30], ['ชาเย็นโบราณ', 'ชาเย็นเข้มข้นหวานมันกำลังดี', 25]],
  [['ต้มยำกุ้งน้ำข้น (เดี่ยว)', 'กุ้งแม่น้ำใหญ่ เห็ดฟาง ตะไคร้ ใบมะกรูด', 180], ['ต้มยำปลาช่อน (เดี่ยว)', 'ปลาช่อนสด เผ็ดแซ่บน้ำข้น', 150], ['แกงส้มชะอมไข่ปลา', 'แกงส้มรสจัดจ้าน ชะอมกรอบ ไข่ปลาเค็มมัน', 120], ['ข้าวสวย', 'ข้าวหอมมะลินึ่งร้อน', 15], ['น้ำมะพร้าวแก้ว', 'มะพร้าวอ่อนหวานฉ่ำ', 45]],
  [['ผัดไทยกุ้งสด', 'กุ้งสดเนื้อแน่น ไข่ใหญ่ ถั่วงอกสด สูตรดัง 40 ปี', 120], ['ผัดไทยห่อไข่', 'ผัดไทยห่อไข่ทองบาง ราดซอสเข้มข้น', 100], ['ก๋วยเตี๋ยวคั่วไก่', 'เส้นก๋วยเตี๋ยวคั่วราดไก่มัน หอมน้ำมันเจียว', 80], ['ปอดทอดกรอบ', 'ปอดทอดกรอบนอก ชุ่มฉ่ำข้างใน พร้อมน้ำจิ้ม', 60], ['น้ำอัดลมไทย', 'อัดลมคลาสสิกแก้วใหญ่', 25]],
  [['ส้มตำปูปลาร้า', 'ตำรสแซ่บจัด ปูนาเค็มมัน ปลาร้าหอมแท้', 70], ['ส้มตำไทย', 'รสกลมกล่อมหวานเปรี้ยว เผ็ดน้อย', 60], ['ไก่ย่างขมิ้น', 'ไก่ย่างไฟอ่อนหมักขมิ้น หอมนุ่มฉ่ำ', 90], ['ข้าวเหนียวนึ่ง', 'ข้าวเหนียวนุ่มร้อน ๆ ในตะกร้า', 15], ['ลาบหมู', 'หมูสับคั่วแป้ง รสแซ่บจัด ขมิ้นอ่อน', 75]],
  [['มาร์เกอริต้า', 'ซอสมะเขือเทศอิตาเลียน มอสซาเรลล่า ใบโหระพา', 220], ['เปปเปอโรนี', 'เปปเปอโรนีเผ็ด ๆ ชีสยืดเยิ้มเต็มจาน', 250], ['ฮาวายเอียน', 'แฮมและสับปะรดสด รสกลมกล่อม', 240], ['เฟรนช์ฟราย', 'มันฝรั่งทอดกรอบพร้อมซอส', 70], ['โค้กแก้วใหญ่', 'เย็นฉ่ำพร้อมน้ำแข็ง', 35]],
  [['ซาลม่อนโรล', 'แซลมอนสดหนา ครีมชีส อะโวคาโด', 160], ['คาลิฟอร์เนียโรล', 'ปูอัด แตงกวา ไข่ปลาสีส้ม', 120], ['ไข่ปลากุนิง (2 ชิ้น)', 'นิกิริไข่ปลาแซลมอนรสเค็มมัน', 90], ['เกี๊ยวซ่าทอด', 'เกี๊ยวซ่ากรอบนอก ฉ่ำข้างใน 4 ชิ้น', 80], ['มัทฉะลาเต้', 'ชาเขียวเข้มข้นผสมนมสด', 65]],
  [['ไก่ทอดหาดใหญ่ (ชิ้นใหญ่)', 'ไก่ทอดกรอบ หมักเครื่องเทศสูตรลับ', 55], ['ไก่ทอด 3 ชิ้น + ข้าวเหนียว', 'ชุดคุ้มค่า ไก่ร้อน ๆ กับข้าวเหนียวนุ่ม', 89], ['ปีกไก่ทอด (6 ชิ้น)', 'ปีกกรอบราดซอสหวานเผ็ด', 99], ['เฟรนช์ฟรายใหญ่', 'มันทอดกรอบนอกนุ่มใน', 45], ['น้ำส้มคั้นสด', 'ส้มสายน้ำผึ้งคั้นสด 100%', 40]],
  [['ก๋วยเตี๋ยวเรือนต้มยำ', 'เส้นเล็กต้มยำเข้มข้น เนื้อนุ่ม ลูกชิ้นปลา', 60], ['ก๋วยเตี๋ยวเรือนน้ำใส', 'น้ำซุปกระฉิ่น เครื่องแน่น', 55], ['เนื้อนุ่มพิเศษ', 'เพิ่มเนื้อนุ่มพิเศษอีกชิ้น', 35], ['ผักบุ้งลวก', 'ผักสดลวกร้อน พร้อมน้ำจิ้มแจ่ว', 20], ['น้ำอัดลมโบราณ', 'อัดลมใส่น้ำแข็งเย็นเจี๊ยบ', 20]],
];

const CAT_NAMES = ['เมนูแนะนำ', 'จานหลัก', 'ของทานเล่น', 'เครื่องดื่ม'];

async function main() {
  const rests = await get('restaurants', { is_active: 'eq.true', select: 'id,name', order: 'rating.desc.nullslast' });
  console.log(`พบร้าน ${rests.length} ร้าน — เริ่มเปลี่ยนเป็นไทย`);
  for (let r = 0; r < rests.length; r++) {
    const spec = RESTAURANTS[r % RESTAURANTS.length];
    await patch('restaurants', { id: `eq.${rests[r].id}` }, {
      name: spec.name, description: spec.desc, address_line: spec.addr,
      city: spec.city, district: spec.district, phone: spec.phone,
      cuisine_types: spec.cuisines, price_range: spec.price, is_open: true,
      approval_status: 'approved', prep_time_avg_minutes: 20,
      slug: `ft-${r + 1}`,
    });
    const cats = await get('categories', { restaurant_id: `eq.${rests[r].id}`, select: 'id', order: 'sort_order.asc.nullslast' });
    for (let c = 0; c < cats.length; c++) {
      await patch('categories', { id: `eq.${cats[c].id}` }, { name: CAT_NAMES[c % CAT_NAMES.length], sort_order: c });
    }
    const items = await get('menu_items', { restaurant_id: `eq.${rests[r].id}`, select: 'id', order: 'sort_order.asc.nullslast' });
    for (let i = 0; i < items.length; i++) {
      const menu = DISHES[r % DISHES.length];
      const dish = menu[i % menu.length];
      await patch('menu_items', { id: `eq.${items[i].id}` }, {
        name: dish[0], description: dish[1], base_price: dish[2],
        is_available: true, is_popular: i < 2, sort_order: i,
      });
    }
    console.log(`OK ร้าน ${r + 1}: ${spec.name} (หมวด ${cats.length}, เมนู ${items.length})`);
  }
  console.log('เสร็จสิ้น — ข้อมูลตั้งต้นไทยครบทุกร้าน');
}
main().catch((e) => { console.error(e); process.exit(1); });
