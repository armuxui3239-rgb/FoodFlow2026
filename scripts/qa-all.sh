#!/usr/bin/env bash
# qa-all.sh — รันชุดทดสอบธุรกิจครบทั้ง 4 ชุดตามลำดับ (ต้องเปิด dev server ที่ :3000 ก่อน)
# ใช้: bash scripts/qa-all.sh [baseUrl]
# ชุด: qa-smoke (วงจรหลัก 42 จุด) -> เติมเงินครบวงจร (22) -> ชำระ 3 วิธี+ทิป (20) -> ลืม PIN อนุมัติแอดมิน (15)
set -e
cd "$(dirname "$0")/.."
echo "═══ 1/4 qa-smoke (วงจรธุรกิจหลัก) ═══"
node scripts/qa-smoke.mjs "$@"
echo "═══ 2/4 verify-topup-flow (เติมเงินครบวงจร) ═══"
node scripts/verify-topup-flow.mjs "$@"
echo "═══ 3/4 verify-payments-flow (ชำระ 3 วิธี + ทิป) ═══"
node scripts/verify-payments-flow.mjs "$@"
echo "═══ 4/4 verify-pin-reset-flow (ลืม PIN อนุมัติแอดมิน) ═══"
node scripts/verify-pin-reset-flow.mjs "$@"
echo "═══ ผ่านครบทั้ง 4 ชุด (99 จุดตรวจ) ═══"
