# ตารางแทนที่บริการบุคคลที่สาม (v4 ข้อ 3) — ตรวจโค้ดจริง 2026-11-14

> หลักการ v4 ข้อ 0.1/§3: ใช้แม่แบบทั้งก้อน เปลี่ยนเฉพาะ "ตัวบริการบุคคลที่สาม" เป็นโอเพ่นซอร์สบน Supabase
> **หลักฐานสด (grep src/ ทั้งหมด 2026-11-14): twilio 0 · firebase 0 · fcm 0 · sepay 0 · deepseek 0 · paypal 0 · stripe 0 · google_maps 0 · maps.googleapis 0 · oauth 0 ไฟล์** — เกณฑ์ยอมรับ 12.12 ผ่าน
> ทุกงานสำเร็จในระบบ บน Supabase เท่านั้น (ตามแผน [OPEN-SOURCE-PLAN.md](OPEN-SOURCE-PLAN.md))

| ของเดิมในแม่แบบ | แทนด้วย (ของเรา) | สถานะตรวจจริง | หลักฐาน |
|---|---|---|---|
| **Twilio (SMS)** | รหัสยืนยันสร้างเอง แสดง**ในแอป** (`VERIFICATION_DELIVERY=internal_code`) — ไม่มีช่องทางออกนอกระบบ | ✅ ตัดหมด | grep twilio = 0 · docs/SMS_GATEWAY_ANDROID_TH.md ระบุ archived |
| **Firebase / FCM (push)** | Supabase Broadcast (แชท/สาย/เหตุการณ์) + แจ้งเตือน**ในแอป** (`notifications` ตาราง + เส้นเขียนจริงจากเติมเงิน) | ✅ ตัดหมด — แถว catalog FCM ในหน้า integrations ถอดแล้ว (เฟส 6) | grep firebase/fcm = 0 · ข้อจำกัดที่รับไว้: แจ้งเตือนตอนปิดแอปไม่ทำงาน |
| **Google Maps** | MapLibre GL + แผนที่ OSM (tile URL จาก env `MAP_STYLE_UPSTREAM`) + รองรับไฟล์ **PMTiles** เพื่อโหมดออฟไลน์ (`NEXT_PUBLIC_MAP_PMTILES_URL`) | ✅ | grep google_maps/maps.googleapis = 0 · src/lib/map-config.ts · map-pmtiles.ts |
| **Google Directions (ETA)** | คำนวณ **ระยะเส้นตรง (haversine) ÷ ความเร็วเฉลี่ย 25 กม./ชม.** — แสดงในหน้าติดตามพร้อมป้าย "ค่าประมาณ ไม่ใช่เส้นทางถนนจริง" (v4 ข้อ 3 กำหนดให้แจ้งสัจจะ) | ✅ (เฟส 6) | src/lib/geo.ts haversineKm · api/orders/[id]/tracking · ทดสอบจริง 1.4 กม. → ~4 นาที · รองรับสลับ OSRM ผ่าน env ภายหลังโดยไม่แก้โค้ด |
| **SePay / ผู้ให้บริการชำระเงิน** | **กระเป๋าเงินของเรา + เงินสดปลายทาง + PromptPay QR สร้างในระบบ** (payload EMVCo เขียนเอง src/lib/promptpay.ts + ไลบรารี qrcode — มาตรฐานเดียวกับ promptpay.io แต่ไม่เรียกภายนอก, ผู้ใช้ยืนยันวิธีนี้ 2026-11-14) | ✅ ตัดหมด | grep sepay/paypal/stripe = 0 · หมายเหตุ: ค่า enum `'sepay'/'mock_wallet'` คงอยู่ในฐานข้อมูล (ไม่ถูกใช้ — ถอดพร้อมรอบความปลอดภัยเพื่อกัน schema break) |
| **PayPal / Google Pay / Apple Pay / บัตร** | ตัดหมด — วิธีชำระ 3 แบบ: กระเป๋าเงิน/เงินสดปลายทาง/พร้อมเพย์ | ✅ | เกณฑ์ 12.12 ✓ |
| **DeepSeek (ผู้ช่วย AI)** | ไม่ใช้ AI ภายนอก — ผู้ช่วยฝั่งบริการใช้**สคริปต์สำเร็จรูปในระบบ** (ai_support_tickets + support_macros) | ✅ ตัดหมด | grep deepseek = 0 · แถว catalog "ผู้ช่วย AI" คงสถานะ not_connected (ปิด flag จริง — ไม่มีปุ่มที่ทำงานโดยยิงภายนอก) |
| **Redis / BullMQ (คิว)** | ไม่ต้องใช้คิวภายนอก — เหตุการณ์เดินด้วย Supabase Broadcast + polling fallback | ✅ N/A | ไม่มี redis ใน dependencies |
| **MinIO (ไฟล์)** | **Supabase Storage** — bucket `topup-slips` (private): อัปโหลด/อ่านผ่าน service key ฝั่ง server เท่านั้น | ✅ (เฟส 5) | api/wallet/topup/slip · api/admin/topups/[id]/slip |
| **Socket.IO (realtime)** | **Supabase Broadcast** — แชทออเดอร์ + สาย WebRTC + ring channels, ชื่อ channel กันเดาด้วย HMAC | ✅ | src/lib/realtime.ts · chat-channel.ts · calls.ts |
| **ล็อกอินโซเชียล FB/Google/Apple** | **เบอร์โทร + PIN** เท่านั้น | ✅ ตัดหมด | grep oauth = 0 · ไม่มีปุ่มโซเชียลในหน้าเข้าสู่ระบบ |
| **LiveKit / coturn (โทรเสียง-วิดีโอภายนอก)** | **WebRTC P2P** สัญญาณผ่าน Supabase Broadcast — `iceServers: []` ตามนโยบาย (จำกัด hard-NAT แจ้งใน UI อย่างสัจจะ) | ✅ | src/lib/calls.ts · /calls/[room] · เกณฑ์ 12.14: คำนวณ/QR/OTP ทำงานได้โดยไม่พึ่งภายนอก (แผนที่ต้อง tile ภายนอกหรือไฟล์ PMTiles) |
| **android-sms-gateway (แผนเก่า)** | archived — แทนด้วย internal_code | ✅ | docs/SMS_GATEWAY_ANDROID_TH.md |

## ข้อจำกัดที่รับไว้ตาม v4 ข้อ 3 (บันทึกตามจริง)

1. แจ้งเตือน**ตอนปิดแอป**ไม่ทำงาน (ตัด push ภายนอก) — แจ้งเตือนในแอปเท่านั้น
2. เส้นทาง/ETA เป็น**ค่าประมาณเส้นตรง** ไม่ใช่ถนนจริง (จนกว่าจะเปิด OSRM ผ่าน env)
3. การยืนยันชำระเงินเติมเงิน = **คนตรวจสลิป** (แอดมิน + audit)
4. ไม่รับบัตรเครดิต
5. แผนที่ OSM สาธารณะเหมาะกับปริมาณน้อย — ใช้หนักต้องเตรียม PMTiles เอง (รองรับแล้ว รอไฟล์)

## สิ่งที่ใช้ของเดิมต่อ (ห้ามรื้อ — ตรวจแล้วครบ)

แชทลูกค้า–ไรเดอร์ · แชทฝ่ายบริการ (support_macros/tickets) · โปรโมชัน · รีวิว · เชิญเพื่อน · กระเป๋าเงิน · ติดตามไรเดอร์ · dispatch · KYC · Admin/Restaurant Dashboard — ทั้งหมดใช้งานได้และผ่าน qa-smoke 42 จุด
