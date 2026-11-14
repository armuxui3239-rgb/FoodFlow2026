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
- OTP ใช้ช่องทาง `internal_code`: รหัสแสดงในหน้า verify-otp ของแอป ไม่มีการส่ง SMS ออกภายนอก
- ไฟล์ `deployments/sms-gateway/` คงไว้เป็นข้อมูลอ้างอิงเท่านั้น — ไม่ต้อง deploy
- เอกสารเดิม: `SMS_GATEWAY_ANDROID_TH.md` (เก็บถาวร)

### 3.2 โทร/วิดีโอ (LiveKit + coturn)
- โค้ดและ compose พร้อมที่ `deployments/calls/`
- **สถานะ: ปิด feature flag** — เปิดเมื่อมีเซิร์ฟเวอร์จริง (แสดงข้อความ "ยังไม่เปิดใช้งาน" ในแอป)

## 4. ขั้นตอนเดปลอย Customer App (Vercel)

1. Fork/clone repo → เชื่อมกับ Vercel project ใหม่
2. ตั้ง Environment Variables ตามข้อ 2 ครบทั้ง 5 ค่า
3. Build command: `bun run build` (Vercel จัดการเอง) — อย่ารัน build ในเครื่อง dev
4. เสร็จแล้วทดสอบ: `/api/restaurants` ต้องตอบ 200 และมีข้อมูลร้านจริง

## 5. การตรวจหลังเดปลอย (Post-deploy Checklist)

- [ ] `/api/restaurants`, `/api/menu/popular`, `/api/promotions` ตอบ 200
- [ ] เข้าสู่ระบบ OTP ได้จริง (internal_code — รหัสแสดงในแอป)
- [ ] สร้างออเดอร์ → QR พร้อมเพย์แสดง → ยอดถูกต้อง (สตางค์)
- [ ] แผนที่โหลด tiles ได้ + มี attribution OSM
- [ ] ไม่มีคีย์ service ปรากฏใน HTML/JS ที่ส่งถึง client

## 6. การกู้คืน (Rollback)

- Vercel: เลือก deployment ก่อนหน้า → "Promote to Production" (ทันที ไม่ต้อง build ใหม่)
- ฐานข้อมูล: แก้สคีมาทุกครั้งต้องมี SQL script ที่รันย้อนได้ใน `deployments/sql/`
