# รายงานสรุปโปรเจกต์ ฟู๊ด ธันเดอร์ (FoodFlow2026) — ขั้นตอนและฟังก์ชันครบทุกส่วน

> **ประเภทงาน: ของเพิ่ม (เอกสารรายงานใหม่) — ไม่ใช่การซ่อม · วันที่: 2026-11-17**
> งานนี้ **ไม่แตะโค้ดใด ๆ · ไม่ commit · ไม่ push** — เขียนไฟล์รายงานฉบับนี้เป็นไฟล์ใหม่เพียงอย่างเดียว ตามคำสั่งเจ้าของ
> ทุกข้อสรุปอ้างหลักฐานไฟล์/คำสั่งที่รันจริงวันนี้ — ตรวจซ้ำได้ตลอด (กติกาที่ 3 ของ docs/OWNER-TRUTH-SHEET.md:16-21)

---

## ส่วนที่ 1 — วิธีตรวจสอบ (แผนที่ใช้จริงในรอบนี้)

ลำดับที่ทำตามหลักเอกสารมาก่อนโค้ด (docs-first):

| ขั้น | สิ่งที่ทำ | เครื่องมือ |
|---|---|---|
| 1 | อ่านแผ่นความจริงฉบับเจ้าของ (docs/OWNER-TRUTH-SHEET.md) ทั้งไฟล์ | Read |
| 2 | อ่าน CHANGELOG.md (หัวไฟล์ถึงเวอร์ชัน 0.6.0) + docs/ROADMAP.md ทั้งไฟล์ | Read |
| 3 | อ่าน docs/PAGE-MAP.md ทั้งไฟล์ (ผังหน้าใช้งานฉบับเต็ม) | Read |
| 4 | นับไฟล์จริงจากโค้ด: `find src/app -name page.tsx` และ `find src/app/api -name route.ts` แล้วแจกแจงทุก path | Bash (Git Bash) |
| 5 | ตรวจ git: branch, ไฟล์ยังไม่ commit, commit ที่ยังไม่ push, `git fetch` เทียบ origin/main | Bash |
| 6 | ตรวจ production จริง: Vercel list_deployments ของโปรเจกต์ foodflow2026 (3 deployment ล่าสุด) | Vercel MCP |
| 7 | เทียบโค้ดจริง ↔ เอกสาร หาความไม่ตรงกัน | การเทียบตาราง |

---

## ส่วนที่ 2 — สรุปผู้บริหาร (ตัวเลขจริงที่นับเองวันนี้)

| หัวข้อ | ค่าจริง | หลักฐาน (รันจริง 2026-11-17) |
|---|---|---|
| จำนวนหน้าใช้งาน (page.tsx) | **109 หน้า** | find จริง: ลูกค้า+ล็อกอิน 42 / แอดมิน 30 / ร้าน 20 / ไรเดอร์ 17 |
| จำนวน API routes (route.ts) | **140 เส้น** | find จริง: ทั่วไป 56 / admin 37 / owner 25 / driver 22 |
| Production | **https://foodflow2026.vercel.app ใช้งานได้** | Vercel MCP: deployment ล่าสุด `dpl_8HueqFBD4vekSKeoaqJTNceLkDHn` state=READY target=production บน commit `8f9e2e3` |
| เวอร์ชันตาม CHANGELOG | **0.7.5** (2026-11-16) — PWA + อัปโหลดรูปโปรไฟล์ + i18n TH/EN + นำการ์ดเหลือง OTP ออก | CHANGELOG.md:6 |
| สถานะ git | local HEAD = origin/main = `8f9e2e3` (ไม่มี commit ค้างไม่ push) | `git fetch` + `git log origin/main..HEAD` = ว่าง |
| ไฟล์ยังไม่ commit | **36 ไฟล์** = งาน v0.7.5 ทั้งหมด (ดูส่วนที่ 8) | `git status --porcelain` |
| ชุดทดสอบธุรกิจ | qa-all.sh 6 ชุดรวม **135 จุด** | scripts/qa-all.sh:2 (42+22+20+15+21+15) |
| เอกสารใน docs/ | **16 ฉบับ** | ls docs จริง |

**สถานะความตรงกัน 3 ฝ่าย (เครื่องจักร ↔ เว็บจริง ↔ เอกสาร)**: commit `8f9e2e3` = local = origin/main = ที่ deploy บน Vercel (READY) → **เครื่องจักรตรงกับเว็บจริง 100%** ที่ระดับ commit ส่วนเอกสารบางฉบับยังตามหลังโค้ดเล็กน้อยจากงาน v0.7.5 ที่ยังไม่ commit (รายการในส่วนที่ 9)

---

## ส่วนที่ 3 — สถาปัตยกรรมและสแต็ค

| ส่วน | รายละเอียด | หลักฐาน |
|---|---|---|
| Framework | Next.js 16 App Router (โฟลเดอร์ `src/app`) | โครงสร้างไฟล์จริง |
| ฐานข้อมูล | Supabase (PostgreSQL + PostGIS) project `lgjwrxrhbksdbzorcwwb` — เข้าถึงผ่าน API routes เท่านั้น (client PostgREST แบบเขียนเอง `src/lib/supabase.ts`, service key, RLS ปิดฝั่ง client) | docs/ARCHITECTURE.md · CHANGELOG |
| Auth | cookie HMAC `ft_session` เขียนเอง + `users.session_version` เพิกถอน session ฝั่งเซิร์ฟเวอร์ | CHANGELOG 0.7.4 ข้อ session (CHANGELOG.md:25-26) |
| Middleware | `src/proxy.ts` (Next 16) — guest gate + role gate | บันทึก QA ก่อนหน้า |
| เงินตรา | เก็บเป็น satang (จำนวนเต็ม) ทั้งระบบ แสดงผลผ่าน `baht()` | CHANGELOG 0.7.2 (คูปอง 100 เท่า) |
| Realtime | Supabase Broadcast (แชท/โทร/ท่อเหตุการณ์ outbox) — ไม่ใช้บริการเจ้าอื่น | CHANGELOG 0.7.0 D7 |
| แผนที่ | MapLibre + OSRM + รองรับ PMTiles + proxy แผ่นที่แคช best-effort | CHANGELOG 0.7.1 ข้อแผนที่ |
| นโยบาย | **จบในระบบ ไม่มีบริการบุคคลที่สาม** (grep = 0: twilio/fcm/sepay/livekit/google maps ฯลฯ) | docs/third-party-replacement.md · ROADMAP.md:49 |
| PWA (ใหม่ v0.7.5 ยังไม่ commit) | manifest + sw.js (ไม่ cache /api/*) + offline.html + ไอคอน 192/512 + pwa-register | CHANGELOG.md:9 + ไฟล์จริง `public/manifest.webmanifest`, `public/sw.js`, `public/icons/` |

---

## ส่วนที่ 4 — ขั้นตอนการทำงานหลักของระบบ (business flows)

### 4.1 วงจรลูกค้า (ทดสอบครบวงจรด้วย qa-smoke 42 จุด — CHANGELOG 0.7.2/QA-WORKFLOW)

1. **สมัครสมาชิก**: `/register` → OTP รหัส 6 หลักระบบสร้างเอง **ลงช่องอัตโนมัติ** (`src/app/verify-otp/page.tsx:48-49`) → ออนบอร์ด 7 จอ (profile→location→notification→**pin**) → cookie `ft_session`
2. **เลือกร้าน/เมนู**: หน้าแรกแนะนำร้าน+โปรโมชัน → `/restaurants` ตัวกรอง → `/food/[id]` เลือกขนาด/ท็อปปิ้ง (menu_item_options 88 กลุ่ม seed) → `/cart`
3. **เช็กเอาต์**: ใช้คูปอง (ตรวจจริงผูก checkout) → เลือก **3 วิธีจ่าย**: กระเป๋าเงิน (หักจริง 2 ชั้น) / เงินสดปลายทาง / พร้อมเพย์ QR สร้างในระบบ (เลขจริง พิสูจน์ถอดรหัส QR บน prod — CHANGELOG 0.7.4:43)
4. **ร้านรับออเดอร์**: kanban 4 ช่วง (`/owner/orders`) → กด "พร้อมส่ง" → **D3 dispatch เสนองานอัตโนมัติ** (คนใกล้ GPS สุดก่อน, TTL 120 วิ, รับคนแรกชนะ, หมดคนกลับสู่กองสาธารณะ)
5. **ไรเดอร์**: รับงาน → pickup → delivering (GPS ทุก 15 วิ → driver_location_history D6) → delivered → completed
6. **หลังส่ง**: ติดตามแผนที่/ETA ค่าประมาณ → รีวิว (`/orders/[id]/rate`) → ทิป ฿10–1,000 → แชทในออเดอร์ → โทร WebRTC P2P (`/calls/[room]`) → แต้มสะสม 1 แต้ม/ออเดอร์ (lib/loyalty.ts)
7. **คืนเงิน (D1)**: ขอคืนในหน้าออเดอร์ (กันซ้ำ 409) → แอดมินอนุมัติ → เงินเข้ากระเป๋า + payments/orders เปลี่ยนสถานะ + แจ้งเตือน + audit

### 4.2 วงจรร้านค้า (20 หน้า)

kanban ออเดอร์ → เมนู CRUD + เปิด/ปิดขาย + หมวดหมู่ → โปรโมชัน CRUD+สถิติ → รีวิว+ตอบ → พนักงาน 5 บทบาท + เชิญผ่านลิงก์ → เวรพนักงาน (D4) → analytics/insights/revenue → **บัญชีธนาคารรับรายได้ จัดการเอง** (v0.7.3) → ตั้งค่าร้าน/โปรไฟล์/เวลาเปิด

### 4.3 วงจรไรเดอร์ (17 หน้า)

สมัคร 3 ขั้น (ข้อตกลง→ยานพาหนะ→เอกสาร) → KYC รอแอดมินอนุมัติ → เปิดรับงาน+GPS → รับข้อเสนอ/จากกองสาธารณะ → ทริป+แผนที่ → รายได้/ประวัติ/โบนัส/คะแนน/ทิป → heatmap จุดน่ารับ → **รายงานทิป end-to-end** → บัญชีธนาคาร (โลโก้ SVG จริง 16 ธนาคาร) → ได้รับเงิน payout (D5)

### 4.4 วงจรแอดมิน (30 หน้า)

ศูนย์ควบคุม KPI → ออเดอร์ (เปลี่ยนสถานะครบ 15 สถานะ + audit log ทุก mutation) → ร้าน (อนุมัติ/ระงับ/แก้บัญชีธนาคาร) → ไรเดอร์ (ตรวจ KYC + แผนที่สด + payout) → ผู้ใช้ (ระงับ/เปิด) → **อนุมัติเติมเงิน** (สลิป Storage + 409 กันอนุมัติซ้ำ) → **อนุมัติรีเซ็ต PIN** → **จัดการคืนเงิน** → คูปอง CRUD → เหตุผลยกเลิก CRUD → รายงาน 7/30/90 วัน + export jobs → audit logs → ซัพพอร์ตตั๋ว+แมโคร → ตั้งค่า 4 หน้า (รวม/แบรนด์/ข้อกำหนด PDPA/การเชื่อมต่อ) → **ท่อเหตุการณ์ outbox drain** (D7) → AI monitor

### 4.5 กลไกพื้นหลัง

- **Dispatch** `src/lib/dispatch.ts`: sequential offer ตามระยะ GPS + lazy-advance + unique index 1 active offer ต่อออเดอร์
- **Outbox** `src/lib/outbox.ts`: push ทุกเปลี่ยนสถานะ → drain ผ่าน Supabase Realtime broadcast
- **Session**: stateless HMAC + `session_version` — logout/เปลี่ยน PIN/ลบบัญชีตาย cookie เก่าทันที (พิสูจน์ prod 5/5)
- **ความปลอดภัย**: RLS ทุกตารางผู้ใช้ (พิสูจน์ยิง anon รั่ว 0) · rate limit ใน proxy (429 จริง) · cookie Secure บน prod · Origin check · OTP TTL 600s/cooldown/caps · PIN bcrypt 12 + กฎวันเกิด-เรียงเลข + ล็อกหนักขึ้น ×2 · ลบบัญชี anonymize จริง (PDPA)
- **เงิน**: satang เต็มระบบ + payout_ledger (driver+restaurant) + wallet_transactions + payments

---

## ส่วนที่ 5 — ฟังก์ชันทั้งหมด: หน้าใช้งาน 109 หน้า (นับจากไฟล์จริง)

### ลูกค้า + ล็อกอิน + ออนบอร์ด = 42 หน้า
`/` หน้าแรก · `/register` `/login` `/verify-otp` `/forgot-pin` · ออนบอร์ด 7 จอ `/onboarding/{intro,profile,location,notification,pin,biometric,welcome}` · `/restaurants` `/restaurants/[id]` `/restaurants/filters` `/search` `/food/[id]` · `/cart` `/checkout` · `/orders` `/orders/[id]` + 3 จอย่อย `{tracking,map,rate}` · `/wallet` `/wallet/topup` · `/points` `/offers` `/invite` · `/addresses` `/favorites` `/messages` `/messages/[id]` `/notifications` · `/help` `/language` `/profile` `/profile/edit` · `/settings` `/settings/notifications` `/settings/security` · `/calls/[room]`

### แอดมิน = 30 หน้า
`/admin` · `/admin/orders` + `[id]` · `/admin/restaurants` + `[id]` · `/admin/drivers` + `[id]` + `/map` · `/admin/users` + `[id]` · `/admin/promotions` `new` `[id]` `[id]/edit` · `/admin/refunds` · `/admin/topups` · `/admin/pin-resets` · `/admin/cancel-reasons` · `/admin/approvals` · `/admin/reports` `/admin/export-jobs` · `/admin/logs` · `/admin/support` + `[id]` · `/admin/settings` + `{branding,compliance,integrations}` · `/admin/analytics` `/admin/ai-monitor`

### ร้านค้า = 20 หน้า
`/owner` · `/owner/orders` + `[id]` · `/owner/menu` `new` `[id]/edit` `categories` · `/owner/promotions` `new` `[id]` `[id]/edit` · `/owner/reviews` · `/owner/staff` · `/owner/analytics` `/owner/insights` `/owner/revenue` `/owner/stats` · `/owner/settings` + `/profile` · `/owner/notifications`

### ไรเดอร์ = 17 หน้า
`/driver` · onboarding 3 จอ `{agreement,vehicle,documents}` · `/driver/kyc` · `/driver/trips/[id]` · `/driver/earnings` `history` `incentives` `ratings` `tips` · `/driver/heatmap` · `/driver/bank` · `/driver/profile` `notifications` `support` `settings`

---

## ส่วนที่ 6 — ฟังก์ชันทั้งหมด: API 140 เส้น (นับจากไฟล์จริง)

### ทั่วไป/ลูกค้า/ล็อกอิน = 56 เส้น
- **Auth (16)**: `auth/login` · `login-pin` · `logout` · `me` · `change-pin` · `verify-pin` · `delete-account` · `otp/send` · `otp/verify` · `reset-pin/status` · `onboard/{profile,location,biometric,pin}`
- **ร้าน/เมนู (7)**: `restaurants` · `restaurants/[id]` · `restaurants/[id]/reviews` · `food/[id]` · `menu/popular` · `promotions` · `promotions/validate`
- **ตะกร้า (2)**: `cart` · `cart/items/[id]`
- **ออเดอร์ (11)**: `orders` · `orders/[id]` · `cancel` · `chat` · `map` · `pay` · `qr` · `review` · `refund-request` · `tracking` (ตัวเลือกจ่ายใน POST orders)
- **กระเป๋าเงิน/แต้ม (6)**: `wallet` · `wallet/topup` · `wallet/topup/slip` · `points` · `referral` · `profile/avatar` *(เพิ่มใหม่ v0.7.5 — ยังไม่ commit)*
- **ผู้ใช้ทั่วไป (7)**: `profile` · `addresses` · `addresses/[id]` · `favorites` · `notifications` · `settings/notifications` · `cancellation-reasons`
- **แชท/โทร/แผนที่ (10)**: `chat/sessions` · `[id]` · `[id]/channel` · `calls/ring` · `calls/token` · `map/proxy` · `proxy.json` · `proxy.png` · `map/style` (+`profile/avatar` อยู่หมวดกระเป๋าเงินแล้ว)

### แอดมิน = 37 เส้น
`admin/{ai-monitor, analytics, approvals, audit-logs, stats, settings}` · `cancel-reasons` + `[id]` · `drivers` + `[id]` + `[id]/payouts` + `drivers/map` · `exports` + `[id]` · `orders` + `[id]` · `outbox` · `payouts/[id]` · `pin-resets` + `[id]` · `promotions` + `[id]` · `refunds` + `[id]` · `reports` · `restaurants` + `[id]` + `[id]/payouts` · `support-macros` · `support-tickets` + `[id]` + `[id]/replies` · `topups` + `[id]` + `[id]/slip` · `users` + `[id]`

### ร้านค้า = 25 เส้น
`owner/{analytics, bank, insights, me, menu, menu/[id], notifications, notifications/[id], orders, orders/[id], payouts, promotions, promotions/[id], revenue, reviews, reviews/[id], settings, settings/profile, stats}` · `categories` + `[id]` · `shifts` + `[id]` · `staff` + `staff/invites`

### ไรเดอร์ = 22 เส้น
`driver/{bank, bank/[id], dispatch, dispatch/[id], earnings, heatmap, history, incentives, kyc, location, me, notifications, notifications/[id], onboarding, payouts, profile, ratings, support, tasks, tips, trips/[id], trips/[id]/tip-report}`

---

## ส่วนที่ 7 — เอกสารคู่ระบบ 16 ฉบับ (docs/)

| ฉบับ | บทบาท |
|---|---|
| OWNER-TRUTH-SHEET.md | **แหล่งความจริงฉบับเดียว** — นิยามเสร็จ/พร้อมใช้/ค้าง + กติกา 3 ข้อ |
| CHANGELOG.md | ปูมเวอร์ชัน (0.2.x→0.7.5) |
| ROADMAP.md | แผนงาน P0/P1/P2 พร้อมหลักฐาน commit |
| PAGE-MAP.md | ผังหน้า 109 หน้า + API |
| ARCHITECTURE.md | สถาปัตยกรรม + นิยาม "OTP ของเรา" §2.3 |
| DEPLOYMENT.md | เส้นทาง deploy Vercel 8 ขั้น + env ครบ |
| QA-WORKFLOW.md | มาตรฐาน QA + บันทึกการรัน |
| TRACEABILITY.md | ตามรอย flow→code→seed→test |
| third-party-replacement.md | ตารางแทนที่บริการเจ้าอื่น (grep = 0) |
| PDPA-PRIVACY-TH.md | ร่างนโยบาย — **รอเจ้าของพิมพ์ "PDPA อนุมัติ"** |
| KEY-ROTATION.md | คู่มือหมุนกุญแจ 3 ตัว — **มือเจ้าของเท่านั้น** |
| BACKUP-RESTORE-TH.md | คู่มือสำรอง/กู้คืน (pg_dump รายสัปดาห์) |
| ENGINEERING.md | มาตรฐาน git/commit/lint |
| OPEN-SOURCE-PLAN.md | แผนจบในระบบ (นโยบายไม่ใช้เจ้าอื่น) |
| UI-ALIGNMENT-PLAN.md | แผนภาษาดีไซน์เจ้าของ เฟส 0-9 ครบ |
| DATABASE.md | จำนวนตาราง/ข้อมูล seed |

## ส่วนที่ 7.1 — การพิสูจน์คุณภาพที่มีอยู่

- **qa-all.sh 6 ชุด 135 จุด** (scripts/qa-all.sh:2): วงจรหลัก 42 · เติมเงินครบจริง 22 · ชำระ 3 วิธี+ทิป 20 · ลืม PIN อนุมัติแอดมิน 15 · คืนเงิน 21 · บัญชีร้าน+โอนรายได้ 15 — รอบล่าสุดผ่านครบทั้ง dev และ production
- **สคริปต์ตรวจ 3 ตัว**: `audit-db-truth.mjs` (อ่านอย่างเดียว) · `audit-rls-anon.mjs` (ยิง anon 64 ตาราง รั่ว 0) · `audit-security-proofs.mjs` (cookie Secure/429/ลบบัญชี 12 จุด)
- **สภาพฐานจริง** (audit-db-truth รอบล่าสุด): ผู้ใช้ 176 · ออเดอร์ 309 · รีวิว 210 · seed 24 ร้าน/192 เมนู/9 เหตุผลยกเลิก · RLS 67/68 (ตัวที่เหลือ = spatial_ref_sys PostGIS ภายใน ถูกต้องตามดีไซน์)

---

## ส่วนที่ 8 — งานที่ทำเสร็จแต่ยังไม่ commit (36 ไฟล์ — v0.7.5 ทั้งก้อน)

จาก `git status --porcelain` จริง: CHANGELOG.md · docs/OWNER-TRUTH-SHEET.md · next.config.ts + 21 หน้า (i18n รอบ Shell/Nav, login, register, onboarding/profile, หน้าแรก, cart, orders, profile, wallet, language, settings, หัวพอร์ทัล 3 ตัว, app-shell) · **ไฟล์ใหม่**: `public/{manifest.webmanifest, sw.js, offline.html, icons/}` + `src/app/api/profile/avatar/` + `src/i18n/` + `src/messages/{th,en}.json` + `src/components/{locale-toggle,pwa-register}.tsx`
**สถานะ: เจ้าของยังไม่อนุมัติ commit/push — production ยังไม่มีงานก้อนนี้** (CHANGELOG.md:6-16 บันทึกไว้แล้วในเครื่อง)

---

## ส่วนที่ 9 — ข้อที่พบจากการตรวจครั้งนี้ (ไม่ได้แก้ — รอคำสั่งเจ้าของ)

| # | ข้อพบ | หลักฐาน | ระดับ |
|---|---|---|---|
| F1 | โค้ดจริงมี **140 API** แต่ PAGE-MAP เขียน **139** — หายไป `/api/profile/avatar` ที่เพิ่มใน v0.7.5 (ยังไม่ commit จึงเอกสารยังไม่ได้แก้) | PAGE-MAP.md:4 vs find จริง | เล็ก (แก้ตอน commit v0.7.5) |
| F2 | CHANGELOG = 0.7.5 แต่ `package.json` version ยัง **"0.6.0"** | package.json (grep version) | เล็ก |
| F3 | PAGE-MAP.md:20 ระบุหน้า `/tracking · /map · /rate` เป็นหน้าเดี่ยว แต่โค้ดจริงคือ `/orders/[id]/tracking` `/orders/[id]/map` `/orders/[id]/rate` (ไม่มีหน้าเดี่ยว) | find จริง | เล็ก (คำอธิบายเบี่ยงจริง ไม่กระทบการใช้งาน) |
| F4 | แผ่นความจริงเขียน Dark mode "รออนุมัติ push" แต่ **push และ deploy สำเร็จแล้วจริง**: commit 32bfd47 อยู่ใน origin/main และ Vercel deploy `dpl_8HueqFBD` บน 8f9e2e3 = READY | git log/fetch + Vercel MCP vs OWNER-TRUTH-SHEET.md:56 (ทั้งฉบับ commit และฉบับแก้) | **ควรแก้ถ้อยคำให้ตรงความจริง** |
| F5 | Dark mode (32bfd47) และ 5 แท็บ (fd39782) ขึ้น production แล้ว ถือเป็น "เสร็จ" ตามนิยาม 4 ข้อ | Vercel READY + qa-smoke 42/42 บน prod (บันทึก 2026-11-15) | ยืนยันสถานะ |

## ส่วนที่ 9.1 — ของค้างทั้งหมดตามแผ่นความจริง (docs/OWNER-TRUTH-SHEET.md:52-60)

1. อนุมัติ **commit + push งาน v0.7.5** (PWA + i18n + โปรไฟล์ + avatar) — รอเจ้าของ
2. **PDPA เปิดนโยบายจริง** — เจ้าของพิมพ์ "PDPA อนุมัติ" เมื่อพร้อม
3. **หมุนกุญแจ 3 ตัว** (DB password / service key / GitHub token) — มือเจ้าของ คู่มือ docs/KEY-ROTATION.md
4. **ลบโปรเจกต์เปล่า food-thunder บน Vercel** — มือเจ้าของกดใน dashboard

---

## ส่วนที่ 10 — เปิดเผยความครอบคลุมของการอ่าน (coverage disclosure)

**อ่านทั้งไฟล์ (ครบทุกบรรทัด) วันนี้**: docs/OWNER-TRUTH-SHEET.md · docs/ROADMAP.md · docs/PAGE-MAP.md · CHANGELOG.md (บรรทัด 1-100, ครบทุกเวอร์ชัน 0.6.0-0.7.5)
**ตรวจด้วยคำสั่งจริงวันนี้**: นับไฟล์ 109 หน้า/140 API + แจกแจงทุก path · git (branch/log/status/fetch) · package.json version · scripts/qa-all.sh · Vercel deployments 3 รายการล่าสุด
**ยังไม่ได้อ่านทั้งไฟล์ในรอบนี้** (อาศัยบันทึกการตรวจรอบก่อน ซึ่งมีหลักฐาน commit ระบุชัด): ARCHITECTURE.md · DEPLOYMENT.md · QA-WORKFLOW.md · TRACEABILITY.md · BACKUP-RESTORE-TH.md · ฯลฯ — หากต้องการตรวจ "ทุกบรรทัด" ของเอกสารเหล่านี้ด้วย แจ้งได้ทันที
**ส่วนที่ยังไม่ได้ทำในรอบนี้**: ยิง API สดทั้ง 140 เส้น (มี qa-all 135 จุดครอบอยู่แล้ว) · เปิดเบราว์เซอร์ทดสอบจริง · แก้เอกสารข้อ F1-F4 ทั้งหมดรอคำสั่งเจ้าของ

---

*จบรายงาน — เขียนเป็นไฟล์ใหม่เท่านั้น ไม่แตะโค้ด · ผู้ตรวจ: ZCode · วันที่ตรวจ: 2026-11-17*
