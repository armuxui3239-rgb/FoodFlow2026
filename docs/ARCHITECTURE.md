# สถาปัตยกรรมระบบ (System Architecture)

อัปเดตล่าสุด: 2026-11-09

## 1. มุมมองภาพรวม (System Context)

```
                    ┌─────────────────────────────┐
                    │      ลูกค้า (มือถือ/เว็บ)      │
                    └──────────────┬──────────────┘
                                   │ HTTPS
                    ┌──────────────▼──────────────┐
                    │   Customer App (Next.js 16) │  ← repository นี้
                    │   App Router + API Routes   │
                    └──────┬───────────────┬──────┘
                           │               │
              REST (service key)    PromptPay payload
                           │               │
              ┌────────────▼────────┐  ┌───▼─────────────┐
              │  Supabase Postgres  │  │  PromptPay QR    │
              │  + PostGIS (62 ตาราง)│  │  (EMVCo payload  │
              │  PostgREST ผ่าน REST │  │   สร้างในระบบเอง) │
              └─────────────────────┘  └─────────────────┘
```

## 2. องค์ประกอบหลัก

### 2.1 Customer App (repository นี้)
- Next.js 16 App Router — หน้าจอลูกค้าทั้งหมดเป็นภาษาไทย 100%
- API Routes ฝั่ง server เป็นตัวกลางเดียวที่เข้าถึงฐานข้อมูล
  (client ไม่พูดกับ Supabase ตรง — กันคีย์ service หลุด)
- Session แบบ cookie ลงลายเซ็นด้วย `SESSION_SECRET` (src/lib/session.ts)

### 2.2 ฐานข้อมูล (Supabase Postgres + PostGIS)
- 62 ตาราง จัดกลุ่มตามโดเมน — รายละเอียดใน [DATABASE.md](DATABASE.md)
- พิกัดร้านใช้ `geography(Point,4326)` + PostGIS → รองรับค้นร้านใกล้ฉัน
- เข้าถึงผ่าน PostgREST ด้วย service key จาก env เท่านั้น

### 2.3 การยืนยันตัวตน (OTP + PIN)
```
เบอร์โทร → POST /api/auth/otp/send ──→ สร้าง otp_codes (hash, TTL, จำกัดลอง)
                                     └─→ รหัสภายในระบบ (internal_code):
                                         แสดงรหัสในหน้า verify-otp ของแอปเรา
                                         ไม่มีการส่ง SMS ออกภายนอก (นโยบายจบในระบบ 2026-11-14)
เอา 6 หลัก → POST /api/auth/otp/verify ──→ session cookie
```
- กฎ OTP: 6 หลัก, หมดอายุ, ผิด 5 ครั้งล็อก, จำกัดขอใหม่ · ช่องทาง = `internal_code` (ค่าเริ่มต้น — จบในระบบ)
- PIN 6 หลักเก็บแบบ hash, มี forgot-pin ผ่าน OTP

### 2.4 วงจรคำสั่งซื้อ (Order Lifecycle)

```
สร้างออเดอร์ (pending_payment)
   → ชำระ PromptPay QR / เงินสด (paid)
   → รอร้านตอบรับ (restaurant_pending)
   → เตรียม/ส่ง ... → ส่งถึงแล้ว (delivered/completed)
   → รีวิว (reviews) + สถานะทุกขั้นบันทึกลง order_status_history
```
- ยกเลิกได้เฉพาะก่อนร้านตอบรับ (src/app/api/orders/[id]/cancel)
- timeout ร้านไม่รับ → job_outbox คิว `order-timeout`

### 2.5 แผนที่ (Open Source ทั้งสาย)
- แผนที่: OpenStreetMap tiles + MapLibre GL
- ผ่าน proxy `/api/map/proxy` + แคชไฟล์ใน `db/cache/map/` (ไม่ลง repo)
- เส้นทาง/พิกัด POI: OSRM + Photon/Nominatim (เอกสารตามแผนใน ROADMAP)

### 2.6 บริการเสริม (deployments/)
| บริการ | สถานะ | ไฟล์ |
|---|---|---|
| OTP รหัสยืนยัน | **จบในระบบ** (`internal_code` — แสดงรหัสในแอป ไม่ส่งออกภายนอก) | `src/lib/verification.ts` |
| โทร/วิดีโอ (LiveKit + coturn) | โค้ดพร้อม, **ปิด feature flag** | `deployments/calls/` |

## 3. การไหลข้อมูลสำคัญ (Data Flows)

1. **สั่งอาหาร**: cart_items → POST /api/orders (คำนวณ subtotal + ค่าส่ง)
   → payments (PromptPay QR) → order_status_history บันทึกทุกสถานะ
2. **กระเป๋าเงิน**: wallet_transactions (amount_delta เป็นสตางค์, type credit/debit)
3. **รีวิว**: ได้หลังออเดอร์ delivered/completed เท่านั้น — ตรวจใน review API
4. **แชท**: chat_sessions (customer_restaurant | ai_support) + chat_messages

## 4. หลักการออกแบบที่ยึดมั่น

1. **โอเพนซอร์สทั้งหมด** — ไม่มีบริการเชิงพาณิชย์แบบปิดในสายวิกฤต
2. **คีย์ไม่หลุดสู่ client** — client คุยกับ API routes ของเราเท่านั้น
3. **เงินเก็บหน่วยสตางค์** (integer) ทุกตาราง — ห้ามใช้ float
4. **ภาษาไทยเป็นค่าเริ่มต้น** — ทุกหน้าจอ
5. **สถานะทุกการเปลี่ยนแปลงต้องมีบันทึกย้อนหลัง** (order_status_history, admin_audit_logs)

## 5. แผนสถาปัตยกรรมถัดไป (ตาม ROADMAP)

- Admin Portal / Restaurant Portal / Driver App แยกเดปลอย (Vercel) ใช้ฐานข้อมูลเดียวกัน
- ระบบจับคู่ไรเดอร์ (dispatch_offers + delivery_tasks) เปิดใช้เมื่อมีข้อมูลไรเดอร์จริง
- LiveKit เปิดเมื่อมีเซิร์ฟเวอร์ (feature flag ควบคุม)
