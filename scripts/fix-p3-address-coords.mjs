// Fix P3: พิกัดที่อยู่ลูกค้า 5 รายการที่ยังเป็นเวียดนาม (10.77, 106.70) → กรุงเทพฯ ตามย่านที่อยู่จริง
// หลักฐาน: ตรวจ /tmp/addr.json วันที่ 2026-11-09 — addresses 5/9 lat~10.77-10.78 lng~106.70 (HCMC)
import crypto from 'crypto';

const URL = process.env.SUPABASE_URL ?? 'https://lgjwrxrhbksdbzorcwwb.supabase.co';
const KEY = process.env.SUPABASE_SERVICE_KEY;
if (!KEY) { console.error('ต้องมี SUPABASE_SERVICE_KEY'); process.exit(1); }
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', Prefer: 'return=representation' };

/** สร้าง hex EWKB ของ Point SRID 4326 (9 ไบต์หัว + 8 lng + 8 lat = 25 ไบต์)
 *  type field ต้องมีแฟล็ก SRID 0x20000000 → uint32 = 0x20000001 ไม่ใช่ 1 */
function wkbPoint(lng, lat) {
  const buf = Buffer.alloc(25);
  buf[0] = 1; // little endian
  buf.writeUInt32LE(0x20000001, 1); // type = point + แฟล็กมี SRID
  buf.writeUInt32LE(4326, 5); // srid
  buf.writeDoubleLE(lng, 9);
  buf.writeDoubleLE(lat, 17);
  return buf.toString('hex');
}

/** พิกัดอ้างอิงย่านจากที่อยู่ (จากแผนที่ OSM จริง) */
const AREA = [
  [/เยาวราช|สัมพันธวงศ์/, [100.5113, 13.7426]],
  [/สุขุมวิท 23|คลองตันเหนือ|คลองเตือนเหนือ/, [100.5696, 13.7292]],
  [/พระราม 4|ปทุมวัน/, [100.5285, 13.7337]],
  [/เจริญกรุง|บางรัก/, [100.5128, 13.7401]],
  [/ทดสอบ|พระบรมมหาราชวัง|พระนคร/, [100.4913, 13.7500]],
  [/คลองเตย/, [100.5545, 13.7208]],
];

async function main() {
  const res = await fetch(`${URL}/rest/v1/addresses?select=id,address_line,location&limit=200`, { headers: H });
  if (!res.ok) throw new Error(`ดึงที่อยู่ไม่สำเร็จ: ${res.status}`);
  const rows = await res.json();
  let fixed = 0;
  for (const r of rows) {
    const buf = Buffer.from(r.location, 'hex');
    const lng = buf.readDoubleLE(9);
    const lat = buf.readDoubleLE(17);
    const inBangkok = lat > 13.5 && lat < 14.2 && lng > 100.2 && lng < 100.98;
    if (inBangkok) continue;

    const area = AREA.find(([pat]) => pat.test(r.address_line))?.[1] ?? [100.5113, 13.7426];
    // เยื้องเล็กน้อยรายบ้านกันซ้อนกันเป๊ะ (deterministic จาก id)
    const h = crypto.createHash('md5').update(r.id).digest();
    const jitterLng = ((h[0] / 255) - 0.5) * 0.004;
    const jitterLat = ((h[1] / 255) - 0.5) * 0.004;
    const loc = wkbPoint(area[0] + jitterLng, area[1] + jitterLat);
    const patch = await fetch(`${URL}/rest/v1/addresses?id=eq.${r.id}`, {
      method: 'PATCH', headers: H, body: JSON.stringify({ location: loc }),
    });
    if (!patch.ok) throw new Error(`แก้ ${r.id} ไม่สำเร็จ: ${await patch.text()}`);
    fixed++;
    console.log(`FIX ${r.id.slice(0, 8)} (${lat.toFixed(3)},${lng.toFixed(3)} → ${area[1].toFixed(4)},${area[0].toFixed(4)}) ${r.address_line.slice(0, 40)}`);
  }
  console.log(`แก้พิกัดที่อยู่ ${fixed} รายการ ✓`);
}

main().catch((e) => { console.error(e); process.exit(1); });
