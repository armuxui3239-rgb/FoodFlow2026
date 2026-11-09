import 'server-only';

/**
 * การตั้งค่าแผนที่ — ตามแพตช์ v3.1 ข้อ 5
 *
 * ช่วงพัฒนา/เปิดตัวปริมาณน้อย: ใช้แผ่นที่สาธารณะของ OpenStreetMap/OpenFreeMap
 * พร้อม attribution + User-Agent ของแอป + แคชแผ่นที่ในเครื่อง
 * เมื่อมี tile server เอง (Protomaps/OpenMapTiles) เปลี่ยนค่า env เดียว — ไม่แก้โค้ด
 */

/** style JSON ต้นทาง (สาธารณะตอนนี้) — เปลี่ยนที่ env ได้ */
export const MAP_STYLE_UPSTREAM =
  process.env.MAP_STYLE_UPSTREAM ?? 'https://tiles.openfreemap.org/styles/liberty';

/** โฮสต์ที่อนุญาตให้ proxy/แคช — ป้องกัน SSRF */
export const MAP_ALLOWED_HOSTS = (process.env.MAP_ALLOWED_HOSTS ?? 'tiles.openfreemap.org')
  .split(',')
  .map((h) => h.trim())
  .filter(Boolean);

/** โฟลเดอร์แคชแผ่นที่ในเครื่อง */
export const MAP_CACHE_DIR = process.env.MAP_CACHE_DIR ?? 'db/cache/map';

/** User-Agent ของแอป (OSM กำหนดให้ระบุตัวตนชัดเจน — ใส่ URL ติดต่อจริงที่ env) */
export const MAP_USER_AGENT = process.env.MAP_USER_AGENT ?? 'FoodThunder/1.0';
