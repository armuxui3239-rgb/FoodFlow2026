# แผนโอเพนซอร์สภายในระบบ — โทร / แชท / แผนที่ / รหัสยืนยันภายใน

> ข้อกำหนดเจ้าของโปรเจค (2026-11-14): ไม่มีการใช้งานแพลตฟอร์มบุคคลที่สาม ทุกอย่างจบภายในระบบเราทั้งหมด บน Supabase เท่านั้น
> ระบบโทร / แชท / แผนที่ เป็นโอเพนซอร์สตามข้อกำหนดนี้ · การส่ง SMS ไปเบอร์โทร ยกเลิก — เปลี่ยนเป็นรหัสยืนยันภายในที่แสดงในระบบ ไม่มีการส่งออกภายนอก แต่การทำงานเหมือนเดิม
> เอกสารนี้คือแผนวิเคราะห์ — ยังไม่ลงมือโค้ด จนกว่าเจ้าของจะสั่งทำตามลำดับ

---

## 0. ขอบเขต (ยึดตาย)

**ใช้ได้** (จบในระบบ / บน Supabase / โอเพนซอร์ส):
- Supabase ทั้งชุด: Postgres + PostgREST + Realtime (Broadcast) + Storage
- Next.js + ไลบรารีโอเพนซอร์สที่มีอยู่ (maplibre-gl, qrcode, bcryptjs ฯลฯ)
- WebRTC ในเบราว์เซอร์ (มาตรฐานเปิด ฝังใน browser แล้ว — ไม่ใช่บริการภายนอก)
- ข้อมูลเปิด OpenStreetMap (ODbL)

**ตัดออกตามข้อกำหนด** (ที่เอกสารเดิมเคยวางไว้):
- ~~Firebase / FCM~~ · ~~DeepSeek~~ · ~~SePay~~ · ~~Twilio~~ · ~~Google Maps~~ · ~~OSRM demo~~
- ~~LiveKit + coturn~~ (ต้องมีเซิร์ฟเวอร์แยก — ขัด "บน Supabase เท่านั้น") · ~~android-sms-gateway~~ (ต้องมือถือคนละระบบ)
- ~~STUN/TURN สาธารณะ~~ (เช่น stun.l.google.com = บริการบุคคลที่สาม)

**ผลตามมาที่ต้องยอมรับอย่างตรงไปตรงมา:**
1. ยืนยันตัวตนด้วยรหัสภายใน = ไม่พิสูจน์ความเป็นเจ้าของเบอร์โทรจริง (ใครรู้เบอร์ก็สมัครได้) — เป็นนโยบายระบบภายในที่เจ้าของกำหนด
2. โทร WebRTC แบบไม่มี TURN = เครือข่ายที่ NAT เข้มจัดอาจเชื่อมกันไม่ได้ (ประมาณการทั่วไป ~10-20% ของเคส) — รายงานสถานะใน UI ตรงไปตรงมา
3. แผนที่แบบ PMTiles ใน Storage ต้องรับภาระพื้นที่จัดเก็บไฟล์ย้อม (ประมาณ 60-80 GB ระดับประเทศ / ~1-2 GB ระดับกรุงเทพฯ+ปริมณฑล) — เสนอเริ่มที่ระดับกรุงเทพฯ

---

## 1. ระบบรหัสยืนยันภายใน (แทน SMS) — เล็กสุด ทำได้ทันทีเมื่อสั่ง

**หลักการ: การทำงานเหมือนเดิม 100% ต่างแค่ "ช่องทางรับรหัส"**

| ขั้นตอน | เดิม (SMS) | ใหม่ (internal_code) |
|---|---|---|
| ขอรหัส | POST /api/auth/otp/send → ส่ง SMS ออกซิม | POST เดิม → บันทึก otp_codes (hash) → **คืนรหัสให้ session เดียวกันแสดงบนจอ** |
| หน้ารับรหัส | รอ SMS เข้ามือถือ | กล่อง "รหัสยืนยันของคุณ" บนหน้า /verify-otp ในระบบเรา |
| ตรวจรหัส | POST /api/auth/otp/verify (เหมือนเดิมทุกอย่าง) | เหมือนเดิมทุกอย่าง |
| กันละเมิด | TTL 300s · 5 ครั้ง · cooldown 55s | เหมือนเดิมทุกอย่าง + รหัสผูก session ที่ขอเท่านั้น (ส่งต่อ/ข้าม session ใช้ไม่ได้) |

**ไฟล์ที่จะแตะ:** `src/app/api/auth/otp/send/route.ts` (เพิ่ม channel `internal_code` — ตัดการเรียก getVerificationDelivery) · `src/app/api/auth/otp/verify/route.ts` (ไม่แก้) · `src/app/verify-otp/page.tsx` (แสดงกล่องรหัสเมื่อ channel = internal_code) · `src/lib/verification.ts` (เพิ่ม internalCodeDelivery — ออกแบบให้ code ไปถึงเฉพาะผู้ขอ: คืนใน response ของ request ที่ขอเท่านั้น ไม่เก็บ plaintext เพิ่ม)
**การตั้งค่า:** `VERIFICATION_DELIVERY=internal_code` (production-safe ไม่ต้อง throw เหมือน dev_console)
**เอกสารที่จะปรับ:** WHAT_I_NEED_TO_PROVIDE.md (ตัด SMS_GATE_* ทิ้ง), ARCHITECTURE.md, DEPLOYMENT.md, SMS_GATEWAY_ANDROID_TH.md (ย้ายไปหมายเหตุ "ไม่ใช้แล้ว")
**ไม่ต้องแก้ schema** — otp_codes มีอยู่แล้ว
**ขนาดงาน:** ~4 ไฟล์ · ครึ่งวัน

---

## 2. ระบบแชทภายในระบบ — ต่อยอดของที่มีอยู่แล้ว

**ปัจจุบัน:** แชทลูกค้า↔ฝ่ายบริการ (/messages) + polling 4 วิ + ตอบสำเร็จรูป
**แผน:** เพิ่ม **แชทรายออเดอร์** (ลูกค้า↔ไรเดอร์, ลูกค้า↔ร้าน) + เปลี่ยน polling → **Supabase Realtime Broadcast** (จบบน Supabase ตรงตามข้อกำหนด)

- **ข้อมูล:** ใช้ตาราง `chat_sessions` / `chat_messages` ที่มีอยู่ (session type ออเดอร์, ผู้ส่ง customer/driver/restaurant) — ⚠️ ต้องตรวจ enum จริงจาก OpenAPI ก่อนโค้ดทุกครั้ง (บทเรียนจาก ExportJobStatus)
- **สด:** Supabase Broadcast channel `chat:{sessionId}` — สิทธิ์ผู้ฟังยืนยันฝั่ง API ก่อนออก token คุย (เฉพาะคู่สนทนาของออเดอร์นั้น) — ข้อความยังบันทึก PostgREST เสมอ (สดเป็นแค่ช่องทางปลุก)
- **หน้าที่จะเพิ่ม:** แท็บแชทใน /orders/[id] (ลูกค้า) · /driver/trips/[id] (ไรเดอร์) · /owner/orders/[id] (ร้าน)
- **ขนาดงาน:** ~8 ไฟล์ (API token คุย + hook ใช้งาน supabase-js realtime + UI แท็บแชท 3 ฝั่ง) · 1-2 วัน
- **dependency เพิ่ม:** @supabase/supabase-js (โอเพนซอร์ส Apache-2.0 — จำเป็นสำหรับ Realtime เพราะ PostgREST REST ไม่มีสายทาง websocket)

---

## 3. ระบบโทร (เสียง/วิดีโอ) — WebRTC ล้วน + signaling บน Supabase Realtime

**หลักการ:** ตัวสื่อ (เสียง/วิดีโอ) วิ่ง **ตรงระหว่างผู้ใช้** (P2P ผ่าน WebRTC มาตรฐานเปิดใน browser) — ส่วน "จับคู่สาย" (signaling: offer/answer/ICE) วิ่งผ่าน **Supabase Realtime Broadcast** — ไม่มีเซิร์ฟเวอร์สื่อกลาง ไม่มีบริการภายนอก

- **flow:** กดปุ่มโทรในออเดอร์ (CallButton ที่มีอยู่) → สร้างห้อง `calls:{orderId}` → ปลายทางได้ push แจ้งเตือนในระบบ (ผ่าน Broadcast อีกช่อง) → รับสาย → แลก SDP offer/answer + ICE candidates ใน channel → เชื่อมสาย P2P
- **หน้าที่จะเพิ่ม/ปรับ:** /calls/[room] มีหน้ารออยู่แล้ว → ต่อ WebRTC จริง · /api/calls/token ปรับเป็นตรวจสิทธิ์คู่สายแล้วออก channel token (แก้บั๊ก user_id→customer_id ด้วย)
- **ข้อจำกัดที่รายงานตรง:** ไม่มี TURN → NAT เข้มอาจทำสายไม่ติด; เสียงดีกว่าวิดีโอบนมือถือเครือข่ายมือถือ
- **ทางแก้อนาคต (ถ้าเจ้าของอนุมัติให้มี host ของระบบเอง):** coturn บนโฮสต์ของเรา (โอเพนซอร์ส) — config ใน deployments/calls มีอยู่แล้วพร้อมต่อ
- **ขนาดงาน:** ~6 ไฟล์ (hook webrtc + signaling API + หน้าสายเรียกเข้า/หน้าสาย) · 2-3 วัน

---

## 4. ระบบแผนที่ — โอเพนซอร์สครบอยู่แล้ว + ทางเลือก "ปิดสนิทใน Supabase"

**ปัจจุบัน (ใช้งานจริง):** OpenStreetMap (ข้อมูลเปิด ODbL) + MapLibre GL (BSD-3) ผ่าน **proxy cache ของเราเอง** (/api/map/proxy — SSRF-guard + disk cache) — ไม่มี Google Maps ตั้งแต่แรก

**ทางเลือกอัปเกรดให้จบใน Supabase 100% (ถ้าต้องการไม่พึ่ง tile host ภายนอกเลย):**
- เก็บ **PMTiles** (รูปแบบโอเพนซอร์ส single-file tile archive) จากข้อมูล OSM ย่านกรุงเทพฯ+ปริมณฑล (~1-2 GB) ลง **Supabase Storage** → proxy อ่านจาก Storage แล้วจ่าย tile เอง → ระบบไม่ยิงออกภายนอกเลยตอนรัน
- เส้นทาง/routing: เทมเพลตใช้ OSRM ภายนอก — แผนของเรา: คำนวณระยะ haversine + ประมาณเส้นทางในระบบ (มี route_polyline คอลัมน์รองรับแล้ว) — ETA แสดงเป็น "โดยประมาณ" ตามหลักไม่หลอกผู้ใช้
- **ขนาดงาน:** script เตรียม PMTiles + แก้ proxy ~3 ไฟล์ · 1 วัน (optional)

---

## 5. ลำดับการทำที่เสนอ (รอคำสั่งอนุมัติทีละข้อ)

| ลำดับ | งาน | ขนาด | เงื่อนไข |
|---|---|---|---|
| 1 | รหัสยืนยันภายใน (แทน SMS) | ~4 ไฟล์ ครึ่งวัน | พร้อมทำทันที |
| 2 | แชทรายออเดอร์ + Realtime Broadcast | ~8 ไฟล์ 1-2 วัน | เพิ่ม @supabase/supabase-js |
| 3 | โทร WebRTC ผ่าน signaling Supabase | ~6 ไฟล์ 2-3 วัน | แจ้งข้อจำกัด NAT ให้ผู้ใช้ทราบใน UI |
| 4 | PMTiles แผนที่ปิดสนิท (optional) | ~3 ไฟล์ 1 วัน | ยอมรับพื้นที่ Storage |

## 6. สรุปค่าที่ไม่ต้องหามาส่งอีกต่อไป (ตามข้อกำหนดใหม่)

~~SMS_GATE_URL/USER/PASSWORD~~ · ~~Firebase/FCM~~ · ~~DeepSeek key~~ · ~~SePay~~ · ~~Twilio~~ · ~~Google Maps key~~ · ~~Railway (SMS/LiveKit)~~
**คงเหลือเพียง:** Supabase โปรเจคเดิมของคุณ + B1 รัน SQL 1 คลิก (ยังค้างจาก REMAINING-WORK)
