-- =====================================================================
-- 2026-11-14 — วิธีชำระเงินกระเป๋าเงิน (UI-ALIGNMENT-PLAN เฟส 5.2 / v4 ข้อ 6)
-- เพิ่มค่า enum 'wallet' ให้ PaymentMethod (additive — ไม่กระทบข้อมูลเดิม)
-- หมายเหตุ: ALTER TYPE ADD VALUE รันนอก transaction เท่านั้น
-- =====================================================================

alter type "PaymentMethod" add value if not exists 'wallet';
