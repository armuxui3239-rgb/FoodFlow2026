# แผนงาน (Roadmap) — เรียงตามลำดับความสำคัญ

อัปเดตจากผลตรวจฐานข้อมูลจริง 2026-11-09
หลักการ: P0 = ข้อมูลผิด/ระบบหักหลังผู้ใช้ ต้องแก้ก่อนอะไรเลย
P1 = ความครบถ้วนของวงจรธุรกิจ, P2 = คุณภาพ/ส่วนขยาย

## P0 — แก้ทันที (ข้อมูลผิดจริง ตรวจพบจากตัวเลขจริง)

| # | งาน | หลักฐาน |
|---|---|---|
| 1 | แก้พิกัด 8 ร้านที่อยู่เวียดนามเป็นกรุงเทพฯ จริง | location ของ 8 ร้าน = lat~10.77,lng~106.7 |
| 2 | เติมเวลาเปิด-ปิดอีก 14 ร้าน (7 วัน/ร้าน) | opening_hours 56/154 แถว |
| 3 | เติมเมนูให้หมวด "ทานเล่น/เครื่องดื่ม" ทุกร้าน | หมวดว่าง 52/88 |
| 4 | seed ออเดอร์ที่เดินจบวงจรครบทุกสถานะ + ผูกไรเดอร์ | ไม่มี delivered, driver_id ว่าง 17/17 |
| 5 | ตั้ง preferred_locale = th ทุกบัญชี + เปลี่ยนอีเมล seed จาก foodflow.vn | vi:21, en:6, th:0 |
| 6 | เชื่อมคูปองเข้า checkout — หักเงินจริง + บันทึก promotion_usages | orders.hardcode promotion_discount: 0 |
| 7 | seed menu_item_options/option_values (ขนาด/ท็อปปิ้งตัวอย่าง) | 0 แถวทั้งคู่ |
| 8 | สร้างบัญชีเจ้าของร้านอีก 14 ร้าน + restaurant_profiles | profiles 8/22 |

## P1 — ความครบถ้วนของระบบ (ภายใน v0.2)

- ไรเดอร์: is_online + พิกัด current_lat/lng ตั้งต้นให้ dispatch ทำงานได้ (ปัจจุบัน NULL ทุกคน)
- customer_profiles ตั้ง default_address_id ครบ + ที่อยู่ให้ลูกค้าที่ยังไม่มี
- platform_settings: seed ค่า config ระบบ (ค่าส่งมาตรฐาน ขั้นต่ำสั่ง ฯลฯ)
- rag_documents: นำ FAQ 15 ข้อขึ้นฐานความรู้ AI (ตอนนี้ hardcode ใน help page)
- ระบบสะสมแต้ม loyalty_transactions + ผู้ใช้ทดสอบ
- ทำความสะอาดออเดอร์ทดสอบยอด ฿1–฿5 (กำหนดนโยบายข้อมูลทดสอบ)
- สถานะระหว่างทางของออเดอร์: preparing / ready_for_pickup / delivering + หน้าติดตามแผนที่เส้นทาง

## P2 — ส่วนขยาย (v0.3 เป็นต้นไป)

- Admin Portal (admin_audit_logs, admin_export_jobs, staff management)
- Restaurant Portal (จัดการเมนู รับ/ปฏิเสธออเดอร์ staff_shifts)
- Driver App (dispatch_offers, driver_location_history, payout_ledger, KYC)
- ระบบคืนเงิน (payment_refund_requests + webhook receipts)
- FCM push จริง (user_fcm_tokens) + realtime_outbox
- เปิด LiveKit โทร/วิดีโอเมื่อมีเซิร์ฟเวอร์ (feature flag)
- ทดสอบโหลดบริการโอเพนซอร์ส (OSRM/geocoder/tiles/SMS gateway) รายงานตัวเลขจริง

## กติกาการใช้ Roadmap

- จบอะไรแต่ละข้อให้ติ๊ก + ใส่ commit hash ที่แก้
- เพิ่มของใหม่ต้องระบุ "หลักฐาน/เหตุผล" เสมอ — ห้ามใส่กำกวม
- ทบทวนสัปดาห์ละครั้งก่อนวางแผนสปรินต์ถัดไป
