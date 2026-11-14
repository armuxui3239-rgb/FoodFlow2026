-- =====================================================================
-- 2026-11-15 — session revocation ฝั่งเซิร์ฟเวอร์ (แก้ข้อพบ medium จากยืนยันรับมือ)
-- users.session_version: logout / เปลี่ยน PIN / ลบบัญชี = ยกเวอร์ชัน
-- cookie ที่ลงชื่อด้วยเวอร์ชันเก่าจะใช้ไม่ได้ทันที (ปิดช่อง cookie ขโมย/จำได้ 7 วัน)
-- additive เท่านั้น
-- =====================================================================

alter table users add column if not exists session_version integer not null default 0;
