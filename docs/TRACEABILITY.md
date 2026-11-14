# ตาราง Traceability — ฟู๊ด ธันเดอร์ (v4 ข้อ 0.3 / 10.12)

> หน้าจอ/โฟลว์ → โค้ด (API หลัก) → ข้อมูลตั้งต้น (seed) → วิธีทดสอบ + ผลจริงล่าสุด (2026-11-14)
> รายการหน้าครบทั้ง 108 จอ อยู่ที่ [PAGE-MAP.md](PAGE-MAP.md) — ตารางนี้จับ "โฟลว์ธุรกิจ" พร้อมหลักฐานทดสอบ
> รันทดสอบทุกชุดคำสั่งเดียว: `bash scripts/qa-all.sh`

## 1) วงจรสมัครและเข้าใช้งาน (v4 ข้อ 4)

| โฟลว์ | หน้าจอ | โค้ดหลัก | Seed | ทดสอบ + ผลจริง |
|---|---|---|---|---|
| สมัครสมาชิก (เบอร์+อีเมล+ชื่อ) | /register · /verify-otp | api/auth/otp/send · otp/verify | — | qa-smoke §2 ✓ · verify-pin-reset ✓ |
| OTP 6 หลัก (TTL 10 นาที, cooldown 60 วิ, cap 5/ชม./เบอร์+10/ชม./IP, ผิด 5 ยกเลิก) | /verify-otp | api/auth/otp/* + lib/verification | otp_codes | กฎใหม่ตรวจจริง 2026-11-14 ✓ (E2E ทุกชุดรันผ่านกฎใหม่) |
| ตั้งโปรไฟล์/ที่อยู่/แจ้งเตือน | /onboarding/* | api/auth/onboard/* | fix-p0-data (ที่อยู่) | qa-smoke ✓ |
| ตั้ง PIN (ปฏิเสธซ้ำ/เรียง/วันเกิด, bcrypt 12, hash ที่ users.password_hash) | /onboarding/pin | api/auth/onboard/pin | — | ทดสอบกฎจริง: 150199/123456/654321 ถูกปฏิเสธ ✓ |
| ล็อกอินเบอร์+PIN (ผิด 5 → ล็อก 15 นาที, ซ้ำใน 1 ชม. = 30 นาที) | /login | api/auth/login-pin | — | qa-smoke + verify-pin-reset ✓ |
| ลืม PIN — ผ่านการอนุมัติแอดมิน | /forgot-pin · /admin/pin-resets | otp/verify (สร้างคำขอ) · api/auth/reset-pin/status · api/auth/onboard/pin (กั้น) · api/admin/pin-resets | password_reset_tokens | **verify-pin-reset-flow 15/15** ✓ |
| เปลี่ยน PIN (ต้องใส่ PIN เดิม) | /settings/security | api/auth/change-pin | — | ทดสอบจริง: ผิด→นับครั้ง, ใหม่ซ้ำ→ปฏิเสธ, สำเร็จ→ล็อกอินได้ ✓ |
| ไบโอเมตริก (placeholder — ไม่เก็บภาพใบหน้า ตาม PDPA) | /onboarding/biometric | api/auth/onboard/biometric | — | qa-smoke ✓ |

## 2) วงจรสั่งอาหารและการเงิน (v4 ข้อ 6 / 8)

| โฟลว์ | หน้าจอ | โค้ดหลัก | Seed | ทดสอบ + ผลจริง |
|---|---|---|---|---|
| หน้าหลัก/ร้าน/เมนู+ตัวเลือก/ตะกร้า/ค้นหา | / · /restaurants* · /food/[id] · /cart | api/restaurants* · api/food · api/cart | fix-p0 + seed-phase7 (เมนู ≥8/ร้าน) | qa-smoke §3 ✓ |
| คูปอง | /checkout | api/promotions/validate + lib/promotion | promotions 6 โค้ด | qa-smoke (รวม P0 ผูกร้าน) ✓ |
| **ชำระ 3 วิธี** — กระเป๋าเงินหักจริง / เงินสดปลายทาง / พร้อมเพย์ QR ในระบบ | /checkout · /orders/[id] | api/orders (paymentMethod) · lib/promptpay · lib/geo | menu/categories | **verify-payments-flow 20/20** ✓ |
| **เติมเงินครบวงจร** — PIN → QR → แนบสลิป → แอดมินอนุมัติ+audit → เงินเข้า+แจ้งเตือน | /wallet/topup · /admin/topups | api/wallet/topup(+slip) · api/auth/verify-pin · api/admin/topups* | wallet_transactions + bucket topup-slips | **verify-topup-flow 22/22** ✓ |
| กระเป๋าเงิน/ประวัติ | /wallet | api/wallet | seed-phase7 (ตัวอย่าง 3 วัน × 8 ลูกค้า) | verify-payments ✓ |
| **ยกเลิก + เหตุผล (แอดมินจัดการ)** | /orders · /orders/[id] · /admin/cancel-reasons | api/orders/[id]/cancel · api/admin/cancel-reasons* | seed-phase7 (9 เหตุผล) | ยกเลิกจริงบันทึกเหตุผล ✓ · COD ยกเลิกไม่ได้ 409 ✓ |
| ทิป (฿10–1,000 + กรอกเอง) | ใน /orders/[id] · /driver/trips/[id] | api/driver/tips · tip-report | — | verify-payments (ขอบเขต ฿5 ปฏิเสธ/฿10 ผ่าน) ✓ |
| แต้มสะสม / โปรโมชัน / เชิญเพื่อน | /points · /offers · /invite | api/points · promotions · referral | fix-p0 | qa-smoke ✓ |

## 3) วงจรร้าน–ไรเดอร์–แอดมิน (v4 ข้อ 7)

| โฟลว์ | หน้าจอ | โค้ดหลัก | Seed | ทดสอบ + ผลจริง |
|---|---|---|---|---|
| ร้านรับ/เตรียม/พร้อมส่ง (kanban) | /owner/* | api/owner/* | fix-p0 (9 ออเดอร์ครบสถานะ) | qa-smoke §4-5 ✓ |
| ไรเดอร์ออนไลน์/รับงาน/GPS/ส่ง | /driver/* | api/driver/* (location ทุก 15 วิ) | fix-p0 (5 ไรเดอร์+GPS) | qa-smoke §5-7 ✓ |
| ติดตาม + แผนที่ + **ETA ค่าประมาณ** | /orders/[id]/tracking · /map | api/orders/[id]/tracking·map + lib/geo | พิกัดร้าน/จุดส่ง | จริง: 1.4 กม. → ~4 นาที ✓ (แจ้ง "ไม่ใช่เส้นทางถนนจริง") |
| รีวิวร้าน/อารมณ์ | /orders/[id]/rate | api/orders/[id]/review | reviews 176 | qa-smoke §8 ✓ |
| แชทลูกค้า–ไรเดอร์ (Supabase Broadcast) | ใน /orders/[id] · /driver/trips/[id] | api/orders/[id]/chat · lib/realtime | — | qa-smoke §9 ✓ (คนแปลกหน้า 401) |
| โทรเสียง/วิดีโอ WebRTC P2P | /calls/[room] | api/calls/* · lib/calls | — | qa-smoke §10 ✓ |
| แอดมินควบคุมทั้งระบบ | /admin/** (29 หน้า) | api/admin/** | seed-portal + phase7 | qa-smoke §11-13 ✓ |
| ออกรายงาน/ส่งออก/audit | /admin/reports · logs · exports | api/admin/exports · audit-logs | admin_audit_logs | qa-smoke + verify-topup §9 ✓ |

## 4) ความปลอดภัยพื้นฐาน (เกณฑ์ v4 ข้อ 12)

| เกณฑ์ | ผลตรวจ 2026-11-14 |
|---|---|
| 12.9 ไม่มีรหัส/PIN plaintext | ✅ เก็บ hash ทุกจุด (bcrypt cost 12) |
| 12.12 ไม่มีบริการบุคคลที่สาม | ✅ grep สด = 0 ทุกคีย์เวิร์ด (twilio/firebase/fcm/sepay/deepseek/paypal/stripe/google_maps/oauth) — รายละเอียด [third-party-replacement.md](third-party-replacement.md) |
| 12.13 ไม่มี hard-code URL/คีย์ | ✅ fallback พร้อมเพย์อ่าน env ทุกไฟล์ (เฟส 6) |
| 12.15 ไม่มี service key ฝั่ง client | ✅ NEXT_PUBLIC มีเฉพาะ URL+anon |
| 12.11 production+dev_console ไม่เริ่มระบบ | ✅ instrumentation.ts |
| คีย์ทั้งหมดใน .env (gitignored) | ✅ ตรวจแล้ว |

## 5) รอบความปลอดภัยเต็ม (เฟส 9 — ตามคิวสุดท้าย)

หมุนคีย์ทุกตัวที่ผ่านแชท (service_role/รหัส DB/PAT) · RLS ทุกตาราง+ทดสอบ · rate limit รวม · cookie Secure · CORS · gitleaks+dependency scan · PDPA · แยก Supabase dev/production — **รอเฟส 9**
