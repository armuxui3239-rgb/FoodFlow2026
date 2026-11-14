-- =====================================================================
-- 2026-11-14 — ระบบคืนเงิน D1 (UI-ALIGNMENT-PLAN / REMAINING-WORK D1)
-- เพิ่มคอลัมน์ผู้ขอ/ผู้ตรวจให้ payment_refund_requests (additive ล้วน)
-- สถานะ: pending -> approved (เงินคืนเข้ากระเป๋า) | rejected | (refunded เมื่อเข้ากระเป๋าแล้ว)
-- =====================================================================

alter table payment_refund_requests
  add column if not exists requested_by uuid references users (id) on delete set null,
  add column if not exists reviewed_by uuid references users (id) on delete set null,
  add column if not exists reviewed_at timestamptz,
  add column if not exists review_note text;
