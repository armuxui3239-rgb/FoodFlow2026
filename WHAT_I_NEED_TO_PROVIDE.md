# WHAT_I_NEED_TO_PROVIDE.md — ค่าที่คุณต้องหามาใส่ใน `.env`

> **อัปเดต 2026-11-14 (เฟส 8):** ข้อ 1-2 (`DATABASE_URL`/`DIRECT_URL`) **ได้รับแล้วและใช้งานอยู่จริง** (migration ทุกตัวรันผ่าน)
> **สิ่งที่ยังต้องการเหลือจริง ๆ:** ① เลขพร้อมเพย์จริง (`PROMPTPAY_ID` — ปัจจุบันระบบใช้ค่าตั้งต้น รอของจริงก่อนขึ้นใช้งาน) ② อนุมัตินโยบาย PDPA ③ Android keystore (สร้างเอง) ④ บัญชี Railway/Vercel (ตอน deploy)
> `SUPABASE_JWT_SECRET` — ยังไม่จำเป็น (แอปไม่ใช้ Prisma migrate จริง; ใช้เมื่อไหร่จะแจ้ง)
> รหัสบัญชีทดสอบย้ายไป `TEST-ACCOUNTS.local.md` (ไม่ commit ตาม v4 ข้อ 8.1)

อัปเดตตามแพตช์ v3.1 ข้อ 1 — ทุกค่าหาได้จากแดชบอร์ด Supabase ของคุณเอง ไม่ต้องติดต่อใคร

---

## 1) `DATABASE_URL` (connection pooler — ใช้กับแอป/Prisma)

**ที่อยู่ในแดชบอร์ด:**

1. เปิด https://supabase.com/dashboard แล้วเข้าโปรเจกต์ `lgjwrxrhbksdbzorcwwb`
2. กดปุ่ม **Connect** ที่แถบด้านบนของหน้าโปรเจกต์ (ข้าง ๆ ปุ่ม Tables)
3. เลือกแท็บ **Transaction pooler** (หรือ "Connection pooling")
4. คัดลอกสตริงที่ขึ้นต้นด้วย `postgresql://postgres.lgjwrxrhbksdbzorcwwb:[YOUR-PASSWORD]@aws-0-...pooler.supabase.com:6543/postgres`
5. เปลี่ยน `[YOUR-PASSWORD]` เป็นรหัสผ่านฐานข้อมูลจริง (ตั้งไว้ตอนสร้างโปรเจกต์ — ถ้าลืม ไปที่ **Project Settings → Database → Reset database password** เพื่อตั้งใหม่)
6. เติม `?pgbouncer=true` ต่อท้ายถ้ายังไม่มี

**รูปแบบสุดท้ายใน `.env`:**

```
DATABASE_URL=postgresql://postgres.lgjwrxrhbksdbzorcwwb:<รหัสผ่าน>@aws-0-<ภูมิภาค>.pooler.supabase.com:6543/postgres?pgbouncer=true
```

หมายเหตุ: พอร์ต **6543** = transaction pooler (เหมาะกับ serverless/Vercel) ถ้าแดชบอร์ดให้เลือก "Session pooler" ใช้พอร์ต 5432 บนโฮสต์ `pooler.supabase.com` เหมือนกัน ใช้ได้ทั้งคู่ — ให้เอาอันที่แดชบอร์ดแสดงตรงตามชื่อ

## 2) `DIRECT_URL` (เชื่อมตรง — ใช้ตอนรัน migration เท่านั้น)

**ที่อยู่ในแดชบอร์ด:**

1. หน้าเดียวกับข้างบน (ปุ่ม **Connect** ที่แถบด้านบน)
2. เลือกแท็บ **Direct connection**
3. คัดลอกสตริงพอร์ต **5432**: `postgresql://postgres:[YOUR-PASSWORD]@db.lgjwrxrhbksdbzorcwwb.supabase.co:5432/postgres`
4. เปลี่ยน `[YOUR-PASSWORD]` เป็นรหัสผ่านเดียวกับข้อ 1

**รูปแบบใน `.env`:**

```
DIRECT_URL=postgresql://postgres:<รหัสผ่าน>@db.lgjwrxrhbksdbzorcwwb.supabase.co:5432/postgres
```

หมายเหตุ: การเชื่อมตรงพอร์ต 5432 ต้องการ IPv6 ถ้าเครือข่าย/แพลตฟอร์มที่รันไม่มี IPv6 (เช่น บางเครือข่ายบ้าน) ให้ใช้ Session pooler (5432 บน `pooler.supabase.com`) เป็น `DIRECT_URL` แทน — Prisma ใช้ค่านี้ได้เหมือนกันเพราะเป็น TCP Postgres ปกติ

## 3) `SUPABASE_JWT_SECRET` (ใช้ตรวจ JWT — เช่น ตรวจ token จาก Auth)

**ที่อยู่ในแดชบอร์ด:**

1. ในโปรเจกต์เดียวกัน ไปที่ **Project Settings** (ไอคอนเฟืองมุมล่างซ้าย)
2. เมนู **API**
3. เลื่อนหาหมวด **JWT Settings** → ช่อง **JWT Secret** → กด **Reveal / Copy**
   - ถ้าแดชบอร์ดเวอร์ชันใหม่แสดงอยู่ในหน้า **API Keys** เป็นรายการ "JWT Secret" ให้กดคัดลอกจากที่นั่น (คลิกจุดสามจุด → Reveal)

**รูปแบบใน `.env`:**

```
SUPABASE_JWT_SECRET=<ข้อความยาวที่คัดลอกมา>
```

---

## สรุปค่าที่ต้องเติมใน `.env` (3 บรรทัด)

```env
DATABASE_URL=postgresql://postgres.lgjwrxrhbksdbzorcwwb:<รหัสผ่าน>@aws-0-<ภูมิภาค>.pooler.supabase.com:6543/postgres?pgbouncer=true
DIRECT_URL=postgresql://postgres:<รหัสผ่าน>@db.lgjwrxrhbksdbzorcwwb.supabase.co:5432/postgres
SUPABASE_JWT_SECRET=<JWT Secret จากหน้า Settings → API>
```

## สิ่งที่ไม่ต้องหาเพิ่ม (มีแล้ว — ยืนยันจากไฟล์ `.env` ปัจจุบัน)

- `SUPABASE_URL` = https://lgjwrxrhbksdbzorcwwb.supabase.co ✅
- `SUPABASE_SERVICE_KEY` (service_role) ✅
- `SESSION_SECRET` ✅

## ค่าที่จะใช้ภายหลัง (ตาม v3.1 ไม่เร่งตอนนี้)

> ⚠️ อัปเดต 2026-11-14 ตามนโยบาย "จบในระบบ บน Supabase เท่านั้น": **ยกเลิกทุกอย่างที่ต้องพึ่งแพลตฟอร์มภายนอก**
> - OTP ใช้ `internal_code` — รหัสแสดงในแอป ไม่ต้องมี SMS_GATE_*/Railway/มือถืออีกต่อไป
> - แผนที่ OSM+MapLibre ใช้ของที่มี (ทางเลือก PMTiles บน Storage เมื่อสั่ง)

| ตัวแปร | สถานะ |
| --- | --- |
| ~~`SMS_GATE_URL` / `SMS_GATE_USER` / `SMS_GATE_PASSWORD`~~ | ❌ ยกเลิก — ไม่ต้องหาแล้ว |
| `MAP_TILE_URL` | ❌ ไม่จำเป็น — ใช้ tiles เปิดผ่าน proxy ของเรา (ทางเลือก PMTiles รอสั่ง) |
| ~~`LIVEKIT_URL` ฯลฯ~~ | ❌ ยกเลิก — โทรใช้ WebRTC P2P + signaling บน Supabase (รอสั่งทำ) |

กฎเดิมปรับ: production ใช้ `VERIFICATION_DELIVERY=internal_code` (ค่าเริ่มต้น) — ไม่ต้องตั้ง SMS_GATE_* อีกต่อไป
