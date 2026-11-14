-- =====================================================================
-- 2026-11-14 — เติมเงินอนุมัติโดยแอดมิน (UI-ALIGNMENT-PLAN เฟส 5.1 / v4 ข้อ 6)
-- 1) คอลัมน์สลิป + ผู้ตรวจ (additive ล้วน — ไม่กระทบข้อมูลเดิม)
-- 2) bucket สลิปแบบ private — อัปโหลด/อ่านผ่าน backend service key เท่านั้น
-- วิธีใช้: รันผ่าน Supabase SQL Editor หรือสคริปต์ apply ใน repo
-- =====================================================================

alter table wallet_transactions
  add column if not exists proof_url text,
  add column if not exists reviewed_by uuid references users (id) on delete set null,
  add column if not exists reviewed_at timestamptz,
  add column if not exists review_note text;

insert into storage.buckets (id, name, public)
values ('topup-slips', 'topup-slips', false)
on conflict (id) do nothing;
