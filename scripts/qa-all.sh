#!/usr/bin/env bash
# qa-all.sh — รันชุดทดสอบธุรกิจครบทั้ง 6 ชุดตามลำดับ (ต้องเปิด dev server ที่ :3000 ก่อน)
# ใช้: bash scripts/qa-all.sh [baseUrl]
# ชุด: qa-smoke (วงจรหลัก 42) -> เติมเงินครบวงจร (22) -> ชำระ 3 วิธี+ทิป (20) -> ลืม PIN อนุมัติแอดมิน (15) -> คืนเงิน (21) -> บัญชีร้าน+โอนรายได้ร้าน (15)
set -e
cd "$(dirname "$0")/.."
echo "═══ 1/6 qa-smoke (วงจรธุรกิจหลัก) ═══"
node scripts/qa-smoke.mjs "$@"
echo "═══ 2/6 verify-topup-flow (เติมเงินครบวงจร) ═══"
node scripts/verify-topup-flow.mjs "$@"
echo "═══ 3/6 verify-payments-flow (ชำระ 3 วิธี + ทิป) ═══"
node scripts/verify-payments-flow.mjs "$@"
echo "═══ 4/6 verify-pin-reset-flow (ลืม PIN อนุมัติแอดมิน) ═══"
node scripts/verify-pin-reset-flow.mjs "$@"
echo "═══ 5/6 verify-refund-flow (ระบบคืนเงิน) ═══"
node scripts/verify-refund-flow.mjs "$@"
echo "═══ 6/6 verify-restaurant-bank (บัญชีร้าน + โอนรายได้ร้าน) ═══"
node scripts/verify-restaurant-bank.mjs "$@"
echo "═══ ผ่านครบทั้ง 6 ชุด (135 จุดตรวจ) ═══"
