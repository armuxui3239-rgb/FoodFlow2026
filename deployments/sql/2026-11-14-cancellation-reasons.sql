-- =====================================================================
-- 2026-11-14 — เหตุผลยกเลิกที่แอดมินจัดการได้ (UI-ALIGNMENT-PLAN เฟส 7 / v4 ข้อ 8.11)
-- ตารางใหม่ — additive ไม่แตะตารางเดิม (orders.cancelled_reason ยังเก็บข้อความเดิม)
-- =====================================================================

create table if not exists cancellation_reasons (
  id uuid primary key,
  label varchar(200) not null unique,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
