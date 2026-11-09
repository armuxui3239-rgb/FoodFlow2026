// Fix P2: rating/total_reviews จากรีวิวจริงทั้ง 22 ร้าน + เติมชื่อคูปองที่ว่าง
// rating = เฉลี่ย (food_rating + delivery_rating) / 2  ปัด 1 ตำแหน่ง
import bcrypt from 'bcryptjs';

const URL = process.env.SUPABASE_URL ?? 'https://lgjwrxrhbksdbzorcwwb.supabase.co';
const KEY = process.env.SUPABASE_SERVICE_KEY;
if (!KEY) { console.error('ต้องมี SUPABASE_SERVICE_KEY'); process.exit(1); }
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', Prefer: 'return=representation' };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function req(t, q, method, body) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const url = `${URL}/rest/v1/${t}?${new URLSearchParams(q)}`;
    const r = await fetch(url, { method: method ?? 'GET', headers: H, body: body ? JSON.stringify(body) : undefined });
    const text = await r.text();
    if (r.ok) { await sleep(80); return text ? JSON.parse(text) : []; }
    console.error(`! ${r.status} ${t}: ${text.slice(0, 150)}`);
    if (r.status === 401 || r.status === 403) process.exit(1);
    await sleep(1500 * (attempt + 1));
  }
  throw new Error(`ล้มเหลวถาวร: ${t}`);
}

const get = (t, q) => req(t, q);
const patch = (t, q, body) => req(t, q, 'PATCH', body);

async function main() {
  const rests = await get('restaurants', { select: 'id,slug,name,rating,total_reviews', limit: '1000' });
  const revs = await get('reviews', { select: 'restaurant_id,food_rating,delivery_rating', limit: '1000' });
  console.log(`ร้าน ${rests.length} | รีวิว ${revs.length}`);

  const per = new Map();
  for (const rv of revs) {
    if (!per.has(rv.restaurant_id)) per.set(rv.restaurant_id, []);
    per.get(rv.restaurant_id).push(rv);
  }

  let fixed = 0, ok = 0;
  for (const rst of rests) {
    const rs = per.get(rst.id) ?? [];
    const count = rs.length;
    const avg = count === 0
      ? 0
      : Math.round((rs.reduce((s, r) => s + (r.food_rating + r.delivery_rating) / 2, 0) / count) * 10) / 10;
    if (Math.abs((rst.rating ?? 0) - avg) > 0.001 || (rst.total_reviews ?? 0) !== count) {
      await patch('restaurants', { id: `eq.${rst.id}` }, { rating: avg, total_reviews: count });
      fixed++;
      console.log(`  FIX ${rst.slug} ${rst.name}: ${rst.rating}(${rst.total_reviews}) → ${avg}(${count})`);
    } else ok++;
  }
  console.log(`rating แก้ ${fixed} | ถูกแล้ว ${ok}`);

  // เติมชื่อคูปองที่ว่าง (ตาราง promotions คอลัมน์ name)
  const promos = await get('promotions', { select: 'code,name,is_active', limit: '100' });
  const NAMES = {
    FREESHIP: 'ฟรีค่าส่งทุกโซน',
    SUMMER50: 'ลด 50% โปรซัมเมอร์',
    WELCOME20: 'ลด 20% สำหรับสมาชิกใหม่',
  };
  let nFixed = 0;
  for (const p of promos) {
    const want = NAMES[p.code];
    if (want && (!p.name || !p.name.trim())) {
      await patch('promotions', { code: `eq.${p.code}` }, { name: want });
      nFixed++;
      console.log(`  FIX promo ${p.code}: name → "${want}"`);
    }
  }
  console.log(`ชื่อคูปองเติม ${nFixed}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
