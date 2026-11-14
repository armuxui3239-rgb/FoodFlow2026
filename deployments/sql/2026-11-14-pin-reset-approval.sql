-- =====================================================================
-- 2026-11-14 — ลืม PIN ต้องผ่านการอนุมัติแอดมิน (UI-ALIGNMENT-PLAN เฟส 6 รอบสอง / v4 ข้อ 4.5)
-- เพิ่มคอลัมน์สถานะ/ผู้ตรวจให้ตาราง password_reset_tokens (ที่ยังไม่เคยถูกใช้) — additive ล้วน
-- สถานะ: pending (รออนุมัติ) -> approved (ตั้ง PIN ใหม่ได้) | rejected | used (ตั้งแล้ว)
-- =====================================================================

alter table password_reset_tokens
  add column if not exists status varchar(20) not null default 'pending',
  add column if not exists reviewed_by uuid references users (id) on delete set null,
  add column if not exists reviewed_at timestamptz,
  add column if not exists review_note text;
