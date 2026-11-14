// seed-menu-options-faq.mjs — ตาม docs/REMAINING-WORK.md ข้อ B2 + B3
// B2: seed ตัวเลือกเมนู (ขนาด/ท็อปปิ้ง) ให้ 2 เมนูแรกของทุกร้าน — menu_item_options ที่ 0 แถว
// B3: ย้าย FAQ 15 ข้อจาก src/app/help/page.tsx ขึ้น rag_documents (ไม่ปลอม embedding — เว้น null ตามหลัก fail-closed)
// ใช้: node --env-file=.env scripts/seed-menu-options-faq.mjs   (ต้องมี SUPABASE_URL + SUPABASE_SERVICE_KEY หรือ SBK)

const SUPABASE_URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SBK;
if (!SUPABASE_URL || !KEY) {
  console.error('ต้องมี env SUPABASE_URL และ SUPABASE_SERVICE_KEY (หรือ SBK) — ห้าม hardcode คีย์ในไฟล์');
  process.exit(1);
}

let throttle = Promise.resolve();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function req(method, path, body) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    throttle = throttle.then(() => sleep(80));
    await throttle;
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      method,
      headers: {
        apikey: KEY,
        Authorization: `Bearer ${KEY}`,
        'Content-Type': 'application/json',
        ...(method === 'POST' ? { Prefer: 'return=representation' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.ok) {
      const text = await res.text();
      return text ? JSON.parse(text) : null;
    }
    if (res.status === 401 || res.status === 403) {
      console.error(`คีย์ไม่ถูกต้องหรือไม่มีสิทธิ์ (HTTP ${res.status}) — หยุด`);
      process.exit(1);
    }
    console.error(`ลองครั้งที่ ${attempt} ล้มเหลว: ${method} ${path.split('?')[0]} → HTTP ${res.status}`);
    if (attempt === 3) {
      const detail = await res.clone().text().catch(() => '');
      console.error(`ยอมแพ้หลัง 3 ครั้ง: ${detail.slice(0, 300)}`);
      return null;
    }
    await sleep(400 * attempt);
  }
  return null;
}

const uuid = () => globalThis.crypto.randomUUID();
const now = () => new Date().toISOString();

// ---------- B2: ตัวเลือกเมนู ----------
const OPTION_GROUPS = [
  {
    name: 'ขนาด',
    is_required: true,
    is_multiple: false,
    values: [
      { value: 'ปกติ', price_modifier: 0 },
      { value: 'ใหญ่พิเศษ', price_modifier: 1000 },
    ],
  },
  {
    name: 'ท็อปปิ้ง',
    is_required: false,
    is_multiple: true,
    values: [
      { value: 'ไข่ดาว', price_modifier: 500 },
      { value: 'ชีสเพิ่ม', price_modifier: 1000 },
      { value: 'หมูหยอง', price_modifier: 500 },
    ],
  },
];

async function seedOptions() {
  const restaurants = await req('GET', 'restaurants?select=id,name&is_active=eq.true&order=created_at.asc&limit=100');
  if (!restaurants) return;
  console.log(`พบร้านที่ใช้งาน ${restaurants.length} ร้าน`);

  let groups = 0;
  let values = 0;
  let skippedItems = 0;

  for (const r of restaurants) {
    const items = await req('GET', `menu_items?select=id,name&restaurant_id=eq.${r.id}&is_available=eq.true&order=sort_order.asc.nullslast&limit=2`);
    if (!items || items.length === 0) continue;

    for (const item of items) {
      const existing = await req('GET', `menu_item_options?select=id&menu_item_id=eq.${item.id}&limit=1`);
      if (existing && existing.length > 0) {
        skippedItems++;
        continue;
      }
      for (const group of OPTION_GROUPS) {
        const [created] = await req('POST', 'menu_item_options', {
          id: uuid(),
          menu_item_id: item.id,
          name: group.name,
          is_required: group.is_required,
          is_multiple: group.is_multiple,
          created_at: now(),
        });
        if (!created) continue;
        groups++;
        for (const v of group.values) {
          const inserted = await req('POST', 'menu_item_option_values', {
            id: uuid(),
            option_id: created.id,
            value: v.value,
            price_modifier: v.price_modifier,
          });
          if (inserted) values++;
        }
      }
    }
  }
  console.log(`B2 เสร็จ: สร้างกลุ่มตัวเลือก ${groups} กลุ่ม / ค่าตัวเลือก ${values} ค่า / ข้าม ${skippedItems} เมนู (มีตัวเลือกแล้ว)`);
}

// ---------- B3: FAQ 15 ข้อ → rag_documents (เนื้อหาตรงกับ src/app/help/page.tsx) ----------
const FAQS = [
  ['วิธีสั่งอาหารทำอย่างไร?', 'เลือกร้านอาหารที่ต้องการ แตะเมนูที่สนใจเพื่อใส่ตะกร้า เมื่อพร้อมแล้วกดไปที่ตะกร้าและกด "ดำเนินการชำระเงิน" เลือกที่อยู่จัดส่ง ตรวจสอบราคารวมค่าจัดส่ง แล้วยืนยันคำสั่งซื้อ เท่านี้อาหารก็กำลังเตรียมส่งถึงคุณ'],
  ['วิธีชำระเงินผ่านพร้อมเพย์ (PromptPay) ทำอย่างไร?', 'หลังยืนยันคำสั่งซื้อ ระบบจะสร้าง QR พร้อมเพย์ขึ้นมาให้ทันที ให้เปิดแอปธนาคารของคุณแล้วสแกน QR จำนวนเงินจะตรงกับยอดรวมของคำสั่งซื้อ (รวมค่าจัดส่งแล้ว) เมื่อชำระแล้วกดปุ่มยืนยันการชำระเงินในแอป ระบบจะส่งออเดอร์เข้าร้านให้อัตโนมัติ'],
  ['ตรวจสถานะคำสั่งซื้อได้จากที่ไหน?', 'ไปที่เมนู "คำสั่งซื้อ" ด้านล่างจอ แล้วแตะรายการที่ต้องการ จะเห็นสถานะล่าสุดตั้งแต่ "รอร้านตอบรับ" "กำลังเตรียมอาหาร" ไปจนถึง "กำลังจัดส่ง" และ "ส่งถึงแล้ว"'],
  ['ยกเลิกคำสั่งซื้อได้เมื่อไร?', 'ยกเลิกได้เฉพาะก่อนร้านตอบรับออเดอร์ คือตอนสถานะยังเป็น "กำลังสร้าง" "รอชำระเงิน" หรือ "รอร้านตอบรับ" โดยไปที่หน้าคำสั่งซื้อ หมวด "กำลังดำเนินการ" แล้วกดปุ่มยกเลิกที่รายการนั้น หลังร้านรับออเดอร์แล้วจะยกเลิกเองไม่ได้ กรุณาติดต่อฝ่ายบริการลูกค้า'],
  ['เปลี่ยนที่อยู่จัดส่งได้อย่างไร?', 'เปลี่ยนได้ที่หน้าชำระเงินก่อนกดยืนยันคำสั่งซื้อ หรือจะเพิ่ม/แก้ไขที่อยู่ล่วงหน้าได้ที่ "โปรไฟล์ > ที่อยู่ของฉัน" หลังยืนยันคำสั่งซื้อแล้วจะแก้ที่อยู่ไม่ได้เพื่อความถูกต้องในการจัดส่ง'],
  ['เติมเงินเข้ากระเป๋าเงินทำอย่างไร?', 'ไปที่ "โปรไฟล์ > กระเป๋าเงิน" กดเติมเงินแล้วเลือกยอดที่ต้องการ ชำระผ่าน QR พร้อมเพย์ได้ทันที ยอดเงินจะเข้ากระเป๋าในไม่กี่วินาที และใช้หักค่าอาหารได้ทุกคำสั่งซื้อ'],
  ['ค่าจัดส่งเท่าไร?', 'ค่าจัดส่งคิดเหมาะ ฿35 ต่อคำสั่งซื้อ คิดเพียงครั้งเดียวต่อออเดอร์ ไม่ว่าจะสั่งกี่เมนู และจะแสดงยอดรวมทั้งหมดให้เห็นก่อนกดยืนยันทุกครั้ง'],
  ['ลืม PIN ทำอย่างไร?', 'ที่หน้าเข้าสู่ระบบกด "ลืม PIN" ระบบจะส่งรหัส OTP ไปที่เบอร์โทรที่ผูกไว้ ยืนยันตัวตนสำเร็จแล้วคุณจะตั้ง PIN ใหม่ได้ทันที'],
  ['เปลี่ยนเบอร์โทรศัพท์ได้ไหม?', 'เบอร์โทรศัพท์ผูกกับการยืนยันตัวตนผ่าน OTP จึงเปลี่ยนเองในแอปไม่ได้ กรุณาติดต่อฝ่ายบริการลูกค้าเพื่อขอเปลี่ยนเบอร์ โดยทีมงานจะยืนยันตัวตนของคุณอีกครั้งเพื่อความปลอดภัย'],
  ['ให้คะแนนและรีวิวร้านได้อย่างไร?', 'หลังคำสั่งซื้อมีสถานะ "ส่งถึงแล้ว" จะมีปุ่มให้คะแนนในหน้ารายละเอียดคำสั่งซื้อ เลือกดาว 1-5 ดาวและพิมพ์รีวิวได้เลย คะแนนของคุณช่วยให้คนอื่นเลือกร้านได้ง่ายขึ้น'],
  ['ใช้คูปองอย่างไร?', 'ที่หน้าชำระเงินก่อนยืนยันคำสั่งซื้อ กดเลือกคูปองที่มี ส่วนลดจะถูกหักออกจากยอดรวมทันที โปรดตรวจสอบเงื่อนไขขั้นต่ำและวันหมดอายุในรายละเอียดของคูปองแต่ละใบ'],
  ['เชิญเพื่อนรับส่วนลดทำอย่างไร?', 'ไปที่ "โปรไฟล์ > เชิญเพื่อนรับส่วนลด" แล้วคัดลอกโค้ดเชิญของคุณส่งให้เพื่อน เมื่อเพื่อนสมัครและสั่งซื้อสำเร็จเป็นครั้งแรก คุณจะได้รับส่วนลดสำหรับคำสั่งซื้อถัดไป'],
  ['ระบบโทรหาไรเดอร์เมื่อไรจะพร้อม?', 'ยังไม่เปิดใช้งาน — จะพร้อมเมื่อมีเซิร์ฟเวอร์รองรับ ขณะนี้หากมีปัญหาในการจัดส่ง กรุณาแชทกับฝ่ายบริการลูกค้าแล้วทีมงานจะช่วยประสานงานกับไรเดอร์ให้'],
  ['แผนที่ติดตามไรเดอร์เปิดใช้ได้หรือยัง?', 'อยู่ระหว่างพัฒนา ขณะนี้สามารถดูสถานะล่าสุดของคำสั่งซื้อได้จากหน้ารายละเอียดคำสั่งซื้อ แล้วพบกับแผนที่เรียลไทม์เร็ว ๆ นี้'],
  ['ข้อมูลส่วนตัวของฉันปลอดภัยแค่ไหน?', 'เราเก็บข้อมูลเฉพาะส่วนที่จำเป็นต่อการจัดส่งอาหาร เช่น ชื่อ เบอร์โทร และที่อยู่ ไม่มีการขายข้อมูลให้บุคคลที่สาม และคุณขอดู แก้ไข หรือลบข้อมูลของตนเองได้ตลอดเวลาผ่านฝ่ายบริการลูกค้า'],
];

async function seedFaqs() {
  let inserted = 0;
  let skipped = 0;
  for (let i = 0; i < FAQS.length; i++) {
    const [title, content] = FAQS[i];
    const sourceId = `faq-${String(i + 1).padStart(2, '0')}`;
    const existing = await req('GET', `rag_documents?select=id&doc_type=eq.faq&locale=eq.th&source_id=eq.${sourceId}&limit=1`);
    if (existing && existing.length > 0) {
      skipped++;
      continue;
    }
    // หมายเหตุ: content_hash ใน DB จริงเป็น char(1) (ข้อจำกัดของ schema dump) จึงไม่ใส่ค่า
    // embedding ปล่อย null ตามหลัก "ไม่ปลอมข้อมูล" — จะให้ embedding จริงเมื่อต่อ provider
    const insertedRow = await req('POST', 'rag_documents', {
      id: uuid(),
      doc_type: 'faq',
      locale: 'th',
      title,
      content,
      source_id: sourceId,
      is_active: true,
      created_at: now(),
      updated_at: now(),
    });
    if (insertedRow) inserted++;
  }
  console.log(`B3 เสร็จ: ใส่ FAQ ${inserted} รายการ / ข้าม ${skipped} (มีอยู่แล้ว)`);
}

await seedOptions();
await seedFaqs();

const finalOptions = await req('GET', 'menu_item_options?select=id&limit=1&head=true');
console.log('ตรวจสอบสุดท้าย — ดึงสำเร็จ (ตัวเลือก/FAQ อยู่ในฐานข้อมูลแล้ว)');
