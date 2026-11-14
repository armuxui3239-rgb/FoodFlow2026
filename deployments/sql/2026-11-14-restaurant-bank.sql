-- =====================================================================
-- 2026-11-14 — บัญชีธนาคารรับรายได้ของร้าน (เจ้าของจัดการเอง + แอดมินแก้ได้)
-- เพิ่มล้วน — ร้านเก็บบัญชีเดียว (ใช้โอนรายได้จากศูนย์ควบคุม)
-- =====================================================================

alter table restaurants add column if not exists bank_name text;
alter table restaurants add column if not exists bank_account_number text;
alter table restaurants add column if not exists bank_account_name text;
