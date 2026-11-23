# แผนงาน (Roadmap) — เรียงตามลำดับความสำคัญ

อัปเดตจากผลตรวจฐานข้อมูลจริง 2026-11-14 (ทบทวนจากฉบับ 2026-11-09)
หลักการ: P0 = ข้อมูลผิด/ระบบหักหลังผู้ใช้ ต้องแก้ก่อนอะไรเลย
P1 = ความครบถ้วนของวงจรธุรกิจ, P2 = คุณภาพ/ส่วนขยาย

## P0 — แก้ทันที (ข้อมูลผิดจริง ตรวจพบจากตัวเลขจริง)

| # | งาน | สถานะ | หลักฐาน |
|---|---|---|---|
| 1 | แก้พิกัด 8 ร้านที่อยู่เวียดนามเป็นกรุงเทพฯ จริง | ✅ เสร็จ | scripts/fix-p0-data.mjs (PATCH location ทั้ง 8 ร้าน) |
| 2 | เติมเวลาเปิด-ปิดอีก 14 ร้าน (7 วัน/ร้าน) | ✅ เสร็จ | scripts/fix-p0-data.mjs (insert 154 แถวครบ) |
| 3 | เติมเมนูให้หมวด "ทานเล่น/เครื่องดื่ม" ทุกร้าน | ✅ เสร็จ | scripts/fix-p0-data.mjs (catalog 18 เมนู) |
| 4 | seed ออเดอร์เดินวงจรครบทุกสถานะ + ผูกไรเดอร์ | ✅ เสร็จ | scripts/fix-p0-data.mjs (9 ออเดอร์ FULL_CHAIN) |
| 5 | ตั้ง preferred_locale = th ทุกบัญชี + เปลี่ยนอีเมล foodflow.vn | ✅ เสร็จ | ALTER TYPE LocaleCode ADD 'th' ผ่าน pg ตรง (DIRECT_URL) + UPDATE 123 บัญชี = th + USER_LOCALE_DEFAULT=th ใน env · อีเมล foodflow.vn = 0 (2026-11-14) |
| 6 | เชื่อมคูปองเข้า checkout — หักเงินจริง + บันทึก promotion_usages | ✅ เสร็จ | /api/promotions/validate + /api/orders (CHANGELOG 0.2.0) + แก้บั๊กหน่วยเงิน fixed 100 เท่า (2026-11-14) |
| 7 | seed menu_item_options/option_values | ✅ เสร็จ | scripts/seed-menu-options-faq.mjs → 88 กลุ่ม (ขนาด+ท็อปปิ้ง) ครบ 2 เมนูแรกของ 22 ร้าน (ตรวจ count=exact 88) |
| 8 | สร้างบัญชีเจ้าของร้านอีก 14 ร้าน + restaurant_profiles | ✅ เสร็จ | scripts/fix-p0-data.mjs (22/22 ร้านมีเจ้าของ) |

## P1 — ความครบถวนของระบบ

- ✅ ไรเดอร์: is_online + พิกัด current_lat/lng — /api/driver/location (PATCH ตรวจ bounds) + dashboard ส่ง GPS ทุก 15 วิ + ผูกกับ /api/orders/[id]/map แล้ว
- ✅ customer_profiles default address + ที่อยู่ทุกลูกค้า (fix-p0-data.mjs)
- ✅ platform_settings seed ค่าระบบ (scripts/seed-portal-data.mjs — 25 แถวจริง)
- ✅ rag_documents นำ FAQ 15 ข้อขึ้นฐานความรู้ (scripts/seed-menu-options-faq.mjs — 15 แถว, embedding ปล่อย null ตามหลักไม่ปลอมข้อมูล)
- ✅ ระบบสะสมแต้มจริง — 1 แต้ม/ออเดอร์จบสมบูรณ์ (lib/loyalty.ts + hook ตอนแอดมินปิด 'completed' · กันเขียนซ้ำ · พังไม่รบกวนออเดอร์ · โมเดลเดียวกับ seed) — พิสูจน์: qa-smoke ออเดอร์ FT2611143066 ได้ 1 แต้มจริง (2026-11-14)
- ✅ ออเดอร์ทดสอบยอด ฿1–฿5 = 0 แถว (ตรวจจริงด้วย scripts/audit-db-truth.mjs — ไม่มีค้าง)
- ✅ สถานะระหว่างทาง + หน้าติดตามแผนที่เส้นทาง (มีครบ)

## P2 — ส่วนขยาย

- ✅ Admin Portal ครบ 26 หน้า (orders/restaurants/drivers+KYC/users/promotions/reports/exports/logs/support/settings×4/analytics/ai-monitor + audit log ทุก mutation)
- ✅ Restaurant Portal ครบ 20 หน้า (kanban/menu CRUD/หมวด/คูปอง/รีวิว+ตอบ/staff+เชิญ/analytics/insights/revenue/settings+profile)
- ✅ Driver Portal ครบ 17 หน้า (onboarding 3 ขั้น/KYC/heatmap/tips/trip map/notifications/profile/support)
- ✅ dispatch_offers เสนองานอัตโนมัติ — D3 เสร็จ (d556b3e: เสนอทีละคนใกล้ GPS สุดก่อน TTL 120 วิ รับคนแรกชนะ + การ์ดข้อเสนอบนแดชบอร์ดไรเดอร์)
- ✅ ระบบคืนเงิน — D1 เสร็จ (4701663: ลูกค้าขอคืน → แอดมินอนุมัติ → เงินเข้ากระเป๋าอัตโนมัติ + audit + กันขอซ้ำ)
- ~~FCM push~~ ยกเลิกตามนโยบายจบในระบบ — แจ้งเตือนในแอปแทน · ✅ realtime_outbox — D7 เสร็จ (4c8a8fd: push ทุกเปลี่ยนสถานะ → drain broadcast ผ่าน Supabase Realtime)
- ~~LiveKit~~ ใช้ WebRTC P2P ในระบบ (รอเซิร์ฟเวอร์เจ้าของเฉพาะกรณีจะเปิด) · ✅ payout_ledger — D5 เสร็จ (4c8a8fd) · ✅ driver_location_history — D6 เสร็จ (4c8a8fd) · ⏳ ทดสอบโหลดบริการโอเพนซอร์ส (รอคำสั่ง)

## เพิ่ม/เสร็จ 2026-11-14 (เฟส 5-8 ตาม UI-ALIGNMENT-PLAN)

| งาน | สถานะ | หลักฐาน |
|---|---|---|
| UI ทั้งระบบเป็นภาษาดีไซน์เจ้าของ + token กลาง + โลโก้จริง + favicon | ✅ | เฟส 1-4 + commit 2e4c7ec (108 หน้า) |
| เติมเงินครบวงจร: PIN→QR ในระบบ→สลิป Storage→แอดมินอนุมัติ+audit→เงินเข้า+แจ้งเตือน | ✅ | 37837b9 · verify-topup-flow 22/22 |
| ชำระ 3 วิธี: กระเป๋าเงินหักจริง/COD/พร้อมเพย์ + ทิป ฿10 | ✅ | 0aee2a2 · verify-payments-flow 20/20 |
| กฎ OTP/PIN ครบ v4 ข้อ 4 (TTL/caps/atomic/วันเกิด-เรียง/ล็อกซ้ำ×2/bcrypt12/password_hash) | ✅ | d0cd8dd · ทดสอบกฎจริง |
| ลืม PIN ผ่านอนุมัติแอดมิน + หน้าจัดการ | ✅ | 8db0f36 · verify-pin-reset-flow 15/15 |
| ETA ค่าประมาณ (แจ้งสัจจะ) + remnant บริการบุคคลที่สามหมด (grep=0) | ✅ | d0cd8dd · third-party-replacement.md |
| Seed ข้อ 8: เมนู ≥8/ร้าน (24 ร้าน) + กาฬสินธุ์/ขอนแก่น + เหตุผลยกเลิกจัดการได้ + กระเป๋าเงินตัวอย่าง + รหัสทดสอบออก README | ✅ | 95ebb6f · seed-phase7.mjs (idempotent 2 รอบ) |
| เอกสารส่งมอบ: TRACEABILITY + third-party-replacement + qa-all.sh | ✅ | เฟส 8 (0.6.0) |
| เฟส 9 ความปลอดภัยรอบเต็ม: RLS ทุกตาราง + rate limit 429 + cookie Secure + Origin check + PDPA + ลบบัญชีจริง | ✅ | 6268974 + b5a4c69 · Release v0.6.0 |
| หมวด D ครบ: D3 dispatch + D1 คืนเงิน + D4 เวร + D5 payout + D6 ประวัติพิกัด + D7 outbox (D2 FCM/D8 LiveKit ยกเลิกตามนโยบาย) | ✅ | d556b3e + 4701663 + 4c8a8fd · E2E 120/120 · CHANGELOG 0.7.0 |
| ยืนยันรับมือรอบ 1-4 (ตรวจโค้ด↔เอกสาร + ฐานจริง + RLS ยิงจริง + QA 135/135 dev+prod) — จับบั๊กจริง 2 ตัวแก้: cookie Secure prod + ลบบัญชี PDPA 500 | ✅ | de3eaca + 0c5b759 · audit-rls-anon + audit-security-proofs 12/12 (2026-11-15) |

## เพิ่ม/เสร็จ 2026-11-22

| งาน | สถานะ | หลักฐาน |
|---|---|---|
| สไลด์เดอร์โปรโมชั่นหน้าแรกเลื่อนอัตโนมัติทุก 5 วินาที (สั่งโดยเจ้าของ) | ✅ | src/app/page.tsx:5,136-152,229 · tsc 0 · eslint 0 · qa-smoke 43/43 · CHANGELOG 0.7.7 |
| วัดหนี้ตัวหนังสือหน้าลูกค้าครบ: 40 หน้า × จอ 375/900/1280 + เว็บจริง 20 หน้า × 375 = 0 จุดล้น (ตัววัดจริงในเบราว์เซอร์ 5 ประเภทจุดพบ) | ✅ | รายงานรอบวัด 2026-11-22 — ขั้นถัดไปของแผน: สตรีสเทสข้อมูลยาว + ตรวจทับซ้อน + พอร์ทัล 67 หน้า |
| เอกสารตามหลังโค้ด แก้ครบ (PAGE-MAP 140 API + เส้นทางจอย่อย / แผ่นความจริง dark+i18n ขึ้น prod / VERSION.md ใหม่ / package.json 0.7.7) | ✅ | เทียบ `find src/app/api -name route.ts` = 140 · PAGE-MAP:4 · OWNER-TRUTH-SHEET:57-58 |
| ขั้น 2 หนี้ตัวหนังสือ: วัดพอร์ทัล 3 ฝั่ง 64 หน้า (ล็อกอินจริง) + ตรวจทับซ้อน = 0 จุด · สตรีสเทสข้อความยาวจับ 13 จุดบน 4 หน้า → แก้ครบ 7 จุด (btn-brand โล่กลาง + truncate-1 ×6) พิสูจน์ซ้ำ = 0 · CHANGELOG 0.7.8 | ✅ | globals.css:129 · help:189 · search:198,240 · settings/security:268 · wallet/topup:186,312 · qa-smoke 43/43 · build ✓ |

## กติกาการใช้ Roadmap

- จบอะไรแต่ละข้อให้ติ๊ก + ใส่ commit hash ที่แก้ (รอบนี้ยังไม่ commit — ใส่ hash หลัง commit ตามคำสั่งเจ้าของ)
- เพิ่มของใหม่ต้องระบุ "หลักฐาน/เหตุผล" เสมอ — ห้ามใส่กำกวม
- ทบทวนสัปดาห์ละครั้งก่อนวางแผนสปรินต์ถัดไป
