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
| 5 | ตั้ง preferred_locale = th ทุกบัญชี + เปลี่ยนอีเมล foodflow.vn | ⏳ ค้าง 1 คลิก | สคริปต์แก้อีเมลแล้ว; ต้องรัน `deployments/sql/add_th_locale.sql` ใน SQL Editor ก่อน (ALTER TYPE ทำผ่าน REST ไม่ได้ — รอเจ้าของโปรเจค) |
| 6 | เชื่อมคูปองเข้า checkout — หักเงินจริง + บันทึก promotion_usages | ✅ เสร็จ | /api/promotions/validate + /api/orders (CHANGELOG 0.2.0) + แก้บั๊กหน่วยเงิน fixed 100 เท่า (2026-11-14) |
| 7 | seed menu_item_options/option_values | ✅ เสร็จ | scripts/seed-menu-options-faq.mjs → 88 กลุ่ม (ขนาด+ท็อปปิ้ง) ครบ 2 เมนูแรกของ 22 ร้าน (ตรวจ count=exact 88) |
| 8 | สร้างบัญชีเจ้าของร้านอีก 14 ร้าน + restaurant_profiles | ✅ เสร็จ | scripts/fix-p0-data.mjs (22/22 ร้านมีเจ้าของ) |

## P1 — ความครบถวนของระบบ

- ✅ ไรเดอร์: is_online + พิกัด current_lat/lng — /api/driver/location (PATCH ตรวจ bounds) + dashboard ส่ง GPS ทุก 15 วิ + ผูกกับ /api/orders/[id]/map แล้ว
- ✅ customer_profiles default address + ที่อยู่ทุกลูกค้า (fix-p0-data.mjs)
- ✅ platform_settings seed ค่าระบบ (scripts/seed-portal-data.mjs — 25 แถวจริง)
- ✅ rag_documents นำ FAQ 15 ข้อขึ้นฐานความรู้ (scripts/seed-menu-options-faq.mjs — 15 แถว, embedding ปล่อย null ตามหลักไม่ปลอมข้อมูล)
- ⏳ ระบบสะสมแต้มจริงตอนสั่งซื้อ (ตอนนี้มีหน้าแสดง + ข้อมูล seed; ยังไม่เขียน loyalty_transactions ตอน POST /api/orders)
- ⏳ ทำความสะอาดออเดอร์ทดสอบยอด ฿1–฿5 (รอนโยบายข้อมูลทดสอบจากเจ้าของ)
- ✅ สถานะระหว่างทาง + หน้าติดตามแผนที่เส้นทาง (มีครบ)

## P2 — ส่วนขยาย

- ✅ Admin Portal ครบ 26 หน้า (orders/restaurants/drivers+KYC/users/promotions/reports/exports/logs/support/settings×4/analytics/ai-monitor + audit log ทุก mutation)
- ✅ Restaurant Portal ครบ 20 หน้า (kanban/menu CRUD/หมวด/คูปอง/รีวิว+ตอบ/staff+เชิญ/analytics/insights/revenue/settings+profile)
- ✅ Driver Portal ครบ 17 หน้า (onboarding 3 ขั้น/KYC/heatmap/tips/trip map/notifications/profile/support)
- ⏳ dispatch_offers เสนองานอัตโนมัติ (ตารางมี 70 แถว — รอคำสั่งอนุมัติทำ D3)
- ⏳ ระบบคืนเงิน (payment_refund_requests — รอคำสั่ง)
- ~~FCM push~~ ยกเลิกตามนโยบายจบในระบบ — แจ้งเตือนในแอปแทน (เฟส 5) · ⏳ realtime_outbox (รอคำสั่ง)
- ⏳ เปิด LiveKit เมื่อมีเซิร์ฟเวอร์ (flag ปิดอยู่ — ปัจจุบันใช้ WebRTC P2P ในระบบ) · ⏳ payout_ledger · ⏳ driver_location_history · ⏳ ทดสอบโหลดบริการโอเพนซอร์ส

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

## กติกาการใช้ Roadmap

- จบอะไรแต่ละข้อให้ติ๊ก + ใส่ commit hash ที่แก้ (รอบนี้ยังไม่ commit — ใส่ hash หลัง commit ตามคำสั่งเจ้าของ)
- เพิ่มของใหม่ต้องระบุ "หลักฐาน/เหตุผล" เสมอ — ห้ามใส่กำกวม
- ทบทวนสัปดาห์ละครั้งก่อนวางแผนสปรินต์ถัดไป
