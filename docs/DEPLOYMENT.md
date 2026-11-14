# การติดตั้งและเดปลอย (Deployment Guide)

## 0. ติดตั้งจากศูนย์ (Fresh Install — Supabase โปรเจกต์ใหม่)

สำหรับเครื่อง/โปรเจกต์ใหม่ที่ยังไม่มีตารางเลย:

```bash
# 1) สร้างโปรเจกต์ใหม่บน supabase.com → เปิด SQL Editor
# 2) รันไฟล์ supabase/schema.sql ทั้งไฟล์ (สร้าง 62 ตาราง + 27 enum + 91 FK ครบ)
#    - ไฟล์นี้สร้างจากโปรเจกต์จริงด้วย scripts/generate-schema-sql.mjs
#    - รวม CREATE EXTENSION postgis / pgcrypto / vector ให้อัตโนมัติ
# 3) ใส่ค่า env ให้ครบ (ดูข้อ 2) แล้วรัน seed ข้อมูลตั้งต้น:
SUPABASE_URL=https://<ref>.supabase.co SBK=<service_role key> bun scripts/seed-thai.mjs
# 4) bun run dev → เข้า http://localhost:3000 ทดสอบ
```

หมายเหตุตรงไปตรงมา:
- `schema.sql` สร้างอัตโนมัติจาก OpenAPI ของ PostgREST — ได้คอลัมน์/ชนิด/NOT NULL/PK/FK ตรงจริงทุกตัว
- DEFAULT บางคอลัมน์ (เช่น id/created_at/is_active) เติมจากที่แอปใช้จริง — คอลัมน์ status ต่าง ๆ ไม่มี default (โค้ดแอปส่งค่าเองอยู่แล้ว)
- ค่า enum รื้อจากข้อมูลจริง + ค่าที่โค้ดเขียนได้สำเร็จในระบบจริง (ดูตรรกะใน `scripts/generate-schema-sql.mjs`)

## 1. สภาพแวดล้อม (Environments)

| สภาพแวดล้อม | ฐานข้อมูล | การยืนยัน OTP | หมายเหตุ |
|---|---|---|---|
| development | Supabase โปรเจกต์ dev / รัน seed ใหม่ได้ | `internal_code` (รหัสแสดงในแอป) | ใช้เครื่องนักพัฒนา |
| production | Supabase โปรเจกต์ production | `internal_code` (ค่าเริ่มต้น — จบในระบบ) | ห้ามมีข้อมูลจำลอง |

## 2. ตัวแปรสภาพแวดล้อมที่ต้องมี (บังคับ 5 ค่า)

ดูแม่แบบใน `.env.example`:

| ตัวแปร | ใช้ทำอะไร | ใครมองเห็นได้ |
|---|---|---|
| `DATABASE_URL` | Prisma (เศษเทมเพลต) | server |
| `SESSION_SECRET` | ลงลายเซ็น session cookie | server เท่านั้น |
| `SUPABASE_URL` | ที่อยู่ PostgREST | server |
| `SUPABASE_SERVICE_KEY` | คีย์เข้าถึงทุกตาราง | server เท่านั้น (server-only) |
| `SUPABASE_ANON_KEY` | คีย์สาธารณะ (ถ้ามีโอเพ่น endpoint) | ได้ทุกฝั่ง |

กฎ: ตั้งค่าผ่าน dashboard ของแพลตฟอร์ม deploy (Vercel/Railway) — **ห้าม commit ไฟล์ .env**

## 3. แผนการเดปลอย (Production Topology)

```
Vercel:  Customer App (repo นี้) · Admin Portal · Restaurant Portal
Railway: ไม่จำเป็นตามนโยบายจบในระบบ (เดิม: job runner, SMS gateway — ยกเลิกแล้ว)
Docker:  deployments/sms-gateway (เก็บถาวร — ไม่ใช้) · deployments/calls (LiveKit — แทนด้วย WebRTC รอสั่ง)
```

### 3.1 SMS Gateway (ยกเลิกการใช้งาน — ตามนโยบายจบในระบบ 2026-11-14)
- OTP ใช้ช่องทาง `internal_code`: รหัสแสดงในหน้า verify-otp **และลงช่องกรอกให้อัตโนมัติ** ไม่มีการส่ง SMS ออกภายนอก
- **นิยาม "OTP ของเรา" (เจ้าของกำหนด 2026-11-14):** UX เหมือน OTP แต่ไม่มี SMS — ระบบสร้างรหัส 6 หลักเอง ลงช่องอัตโนมัติ ผู้ใช้ยืนยัน แล้วพาไปตั้งรหัสผ่าน (PIN) — ใช้ตอนสมัครสมาชิกใหม่เป็นหลัก (+ ยืนตัวตนตอนลืม PIN ซึ่งต้องผ่านแอดมินอนุมัติ)
- ไฟล์ `deployments/sms-gateway/` คงไว้เป็นข้อมูลอ้างอิงเท่านั้น — ไม่ต้อง deploy
- เอกสารเดิม: `SMS_GATEWAY_ANDROID_TH.md` (เก็บถาวร)

### 3.2 โทร/วิดีโอ (LiveKit + coturn)
- โค้ดและ compose พร้อมที่ `deployments/calls/`
- **สถานะ: ปิด feature flag** — เปิดเมื่อมีเซิร์ฟเวอร์จริง (แสดงข้อความ "ยังไม่เปิดใช้งาน" ในแอป)

## 4. เดปลอย Vercel (เปิดใช้งานจริงครั้งแรก — เส้นทางขั้นตอน)

แผนฟรี Hobby: ไม่ต้องบัตรเครดิต · รันไทม์ของเราเรียก Supabase ผ่าน REST ทั้งหมด (ไม่มีการต่อฐานข้อมูลแบบ TCP) — เหมาะกับ serverless โดยตรง · หลังจากนี้ทุกครั้งที่ push ไป `main` = deploy อัตโนมัติ

### 4.1 เส้นทาง 8 ขั้น (ครั้งแรก ≈10 นาที)
1. เปิด https://vercel.com → **Sign Up** → เลือก **Continue with GitHub** (ใช้บัญชี GitHub ที่มีอยู่) → อนุมัติสิทธิ์
2. หน้า dashboard กด **Add New... → Project** → รายการจะเห็น repo `FoodFlow2026` → กด **Import**
3. Framework Preset ขึ้น **Next.js** เอง — **ไม่ต้องแก้** Build/Install/Output ใด ๆ
4. ก่อนกด Deploy เปิด **Environment Variables** → ใส่ครบตามตาราง 4.2 (คัดลอกค่าจาก `.env` ในเครื่อง — Environment เลือกครบ Production + Preview + Development)
5. กด **Deploy** → รอ 2-3 นาที → ได้ URL `https://<ชื่อ>.vercel.app`
6. ตรวจรับตาม checklist ข้อ 5 ด้านล่าง
7. ทดสอบวงจรเต็มบน production จริง (สร้างข้อมูลทดสอบในฐานจริง — รับไว้ได้): `node scripts/qa-smoke.mjs https://<ชื่อ>.vercel.app` (สคริปต์รับ baseUrl — ถ้าเจอ 429 รอ 1 นาทีรันต่อ: rate limit auth 20 ครั้ง/นาที/IP)
8. มีโดเมนเองวันหน้า: Settings → Domains → เพิ่มโดเมน → ตั้ง DNS ตามที่ Vercel แนะนำ

### 4.2 ตาราง Environment Variables บน Vercel
| ตัวแปร | ค่ามาจาก | หมายเหตุ |
|---|---|---|
| `SUPABASE_URL` | .env | ที่อยู่ PostgREST |
| `SUPABASE_ANON_KEY` | .env | realtime ฝั่ง client |
| `SUPABASE_SERVICE_KEY` | .env | server เท่านั้น — ห้ามขึ้น client |
| `SESSION_SECRET` | .env | ลายเซ็น session cookie |
| `VERIFICATION_DELIVERY` | `internal_code` | **ห้าม**ใส่ `dev_console` — production ปฏิเสธเริ่มระบบ (instrumentation) |
| `NEXT_PUBLIC_SUPABASE_URL` | .env | realtime ฝั่ง client |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | .env | realtime ฝั่ง client |
| `NEXT_PUBLIC_CALLS_ENABLED` | `true` | เปิดหน้าโทร |
| `PROMPTPAY_ID` | ⚠ เจ้าของ | **ต้องใส่เลขพร้อมเพย์จริงก่อนเปิดใช้จริง** — ไม่ใส่ = ระบบใช้เบอร์ตัวอย่าง 0812345678 เงินไม่ถึงบัญชีจริง |

ไม่ต้องใส่บน Vercel: `DATABASE_URL`/`DIRECT_URL` (ใช้เฉพาะสคริปต์ในเครื่อง) · `NEXT_PUBLIC_MAP_PMTILES_URL` (ไม่ใส่ = ใช้ OpenFreeMap ผ่าน proxy ในตัว)

### 4.3 ความจริงของ serverless (รู้ไว้ — ใช้งานได้ปกติ ไม่ใช่ปัญหา)
- rate limit แบบ in-memory นับต่ออินสแตนซ์ → บน serverless เพดานหลวมขึ้น (ยังกัน brute-force พื้นฐานได้) — เมื่อโต: เปลี่ยนเป็น Redis/Upstash
- แคชแผ่นที่ดิสก์ใช้ไม่ได้บน Vercel → โค้ดข้ามแคชแล้วตอบภาพตรง (ตั้งแต่ 0.7.1) — เมื่อโต: เปิด PMTiles ไฟล์เดียวจบที่ `NEXT_PUBLIC_MAP_PMTILES_URL`
- outbox drain = ปุ่มที่หน้าแอดมิน — เมื่อโต: Vercel Cron drain อัตโนมัติ
- โทร: สื่อวิ่ง P2P ตรง + STUN ไร้คีย์ — เครือข่ายองค์กร NAT แบบ symmetric อาจยังต่อไม่ได้ — เมื่อโต: coturn บน Railway

## 5. การตรวจหลังเดปลอย (Post-deploy Checklist)

- [ ] `/api/restaurants`, `/api/menu/popular`, `/api/promotions` ตอบ 200
- [ ] สมัครใหม่จริง 1 บัญชี: รหัส 6 หลักขึ้นในแอป **และลงช่องให้อัตโนมัติ** → ตั้ง PIN ได้
- [ ] ตั้ง `PROMPTPAY_ID` เป็นเลขพร้อมเพย์จริงแล้ว (ไม่ใช่ 0812345678 ตัวอย่าง)
- [ ] สร้างออเดอร์ → QR พร้อมเพย์แสดง → ยอดถูกต้อง (สตางค์)
- [ ] แผนที่โหลด tiles ได้ + มี attribution OSM
- [ ] ไม่มีคีย์ service ปรากฏใน HTML/JS ที่ส่งถึง client

## 6. การกู้คืน (Rollback)

- Vercel: เลือก deployment ก่อนหน้า → "Promote to Production" (ทันที ไม่ต้อง build ใหม่)
- ฐานข้อมูล: แก้สคีมาทุกครั้งต้องมี SQL script ที่รันย้อนได้ใน `deployments/sql/`
