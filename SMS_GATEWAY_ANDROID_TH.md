# คู่มือติดตั้ง SMS Gateway บนมือถือ Android ของคุณ (ภาษาไทย)

> ⛔ **เอกสารนี้ยกเลิกการใช้งานแล้ว (เก็บถาวร 2026-11-14)** — ตามนโยบาย "จบในระบบ บน Supabase เท่านั้น ไม่มีแพลตฟอร์มบุคคลที่สาม"
> ระบบ OTP ใช้ช่องทาง `internal_code`: รหัสแสดงในหน้า verify-otp ของแอป ไม่มีการส่ง SMS ออกภายนอกเลย
> เนื้อหาด้านล่างเป็นบันทึกวิธีการเดิม เพื่ออ้างอิงหากนโยบายเปลี่ยนในอนาคต

ตามแพตช์ v3.1 ข้อ 3 — ใช้แอป **SMS Gateway for Android™** (โอเพนซอร์ส Apache-2.0)
ส่ง SMS ออกจากซิมของคุณตรงถึงเบอร์ผู้สมัคร ไม่ผ่านผู้ให้บริการ SMS เชิงพาณิชย์

## หลักฐานจากซอร์สจริง (โคลนและอ่านซ้ำเมื่อรอบนี้ — ทุกบรรทัดตรวจแล้ว)

ซอร์สที่ใช้: แอป `github.com/capcom6/android-sms-gateway` (branch master) และเซิร์ฟเวอร์ `github.com/android-sms-gateway/server` (repo เซิร์ฟเวอร์อยู่ใต้องค์กร `android-sms-gateway` ไม่ใช่ `capcom6`)

1. **แอปรองรับโหมด Private server จริง** — `modules/gateway/GatewaySettings.kt` บรรทัด 42–56: มีช่อง `serverUrl` + `privateToken` (storage key `cloud_url`, `private_token`) และบรรทัด 59 ค่า default คือ `https://api.sms-gate.app/mobile/v1` (แปลว่า URL ที่กรอกต้องมี path `/mobile/v1` ปิดท้าย)
2. **แอปบังคับ HTTPS** — `GatewaySettings.kt` บรรทัด 74–75: `throw IllegalArgumentException("url must start with https://")` → โดเมน `*.up.railway.app` ของ Railway (มี TLS ให้) ใช้ได้ทันที
3. **ปิด FCM/เซิร์ฟเวอร์กลางของผู้พัฒนาได้จริง** — `services/PushService.kt` บรรทัด 73–77: `if (settings.notificationChannel == SSE_ONLY) { "FCM registration skipped: SSE_ONLY channel configured" }`
4. **แอปเชื่อมตรงกับเซิร์ฟเวอร์ของเราผ่าน SSE** — `modules/gateway/services/SSEForegroundService.kt` บรรทัด 44–45: `SSEManager("${settings.serverUrl}/events", ...)` เมื่อต่อสำเร็จจะเรียก `PullMessagesWorker` ดึงข้อความที่ค้างส่งทันที
5. **ฝั่งเซิร์ฟเวอร์มีโหมด private จริง** — `configs/config.example.yml` บรรทัด 19–21: `mode: private # private - protected registration [GATEWAY__MODE]` + `private_token: ... [GATEWAY__PRIVATE_TOKEN]`
6. **เส้นทาง API ที่แท้จริงอยู่ใต้ `/api`** — ไลบรารี `capcom6/go-infra-fx` ไฟล์ `http/http.go` บรรทัด 58: `api := app.Group("/api")` แล้ว mount handler ทุกตัวเข้ากลุ่มนี้ รวมกับ swagger ของเซิร์ฟเวอร์ (`handlers/events/mobile.go:42` = `GET /mobile/v1/events`, `handlers/messages/3rdparty.go:79` = `POST /3rdparty/v1/messages`) → สรุป URL จริงคือ `/api/mobile/v1/...` และ `/api/3rdparty/v1/...`
7. **คำสั่ง push ที่ไหลผ่านเซิร์ฟเวอร์กลาง (ถ้าใช้ upstream) ไม่มีเนื้อหา SMS** — `internal/sms-gateway/modules/events/events.go` บรรทัด 12–14: `NewMessageEnqueuedEvent() → NewEvent(PushMessageEnqueued, nil)` (Data = nil มีแค่ชื่อเหตุการณ์)
8. **เซิร์ฟเวอร์ใช้ MySQL/MariaDB** — `go.mod`: `go-sql-driver/mysql v1.10.1` และ `config.example.yml` หัวไฟล์: "Supported: MySQL 8.0.13+ or MariaDB 10.2.7+, Recommended: MariaDB LTS"
9. **worker เป็น process แยก** — `cmd/sms-gateway/main.go` บรรทัด 15: `cmdWorker = "worker"` → รัน `sms-gateway worker`
10. **การยืนยันตัวตน backend→เซิร์ฟเวอร์ใช้ Basic auth** — เอกสารทางการ (sms-gate.app): "Get username and password from the app's Home screen" + ตัวอย่าง `curl -u <username>:<password> ... /3rdparty/v1/messages` และซอร์สเซิร์ฟเวอร์มี middleware `userauth.NewBasic(usersSvc)`

**สรุปวิธีที่ backend บน Railway ส่งคำสั่งไปถึงมือถือ (พิสูจน์ครบทุกข้อ):**
backend เรา → `POST https://<railway>/api/3rdparty/v1/messages` (Basic auth) → เซิร์ฟเวอร์บันทึกลง MariaDB → มือถือของคุณต่อ SSE ค้างไว้ที่ `https://<railway>/api/mobile/v1/events` รับเหตุการณ์ "ข้อความใหม่" → แอปดึงข้อความ → ส่ง SMS ออกซิม → รายงานสถานะกลับ ทั้งหมดเป็นการเชื่อมตรงระหว่างเซิร์ฟเวอร์ของเรากับมือถือของคุณ (ตั้งแอปเป็น SSE_ONLY แล้วไม่มีอะไรผ่านเซิร์ฟเวอร์กลางของผู้พัฒนาเลย)

---

## สิ่งที่ต้องมี

1. มือถือ Android 5.0 ขึ้นไป ใส่ซิมที่จะใช้ส่ง SMS เปิดทิ้งไว้ ต่อ Wi-Fi/เน็ตคงที่ ตั้งค่าหน้าจอไม่ให้ล็อก (หรือตั้งไม่พับจอเมื่อชาร์จ)
2. เซิร์ฟเวอร์บน Railway ที่ deploy จากไฟล์ `deployments/sms-gateway/docker-compose.yml` ของโปรเจกต์นี้ (ได้ URL เช่น `https://xxx.up.railway.app`)

## ขั้นตอนบนมือถือ (ทำหนึ่งครั้ง)

1. ดาวน์โหลดแอป: เปิดหน้า https://github.com/capcom6/android-sms-gateway/releases แล้วดาวน์โหลดไฟล์ APK รุ่น **release (secure)** ล่าสุด
2. เปิดไฟล์ APK ติดตั้ง (ถ้า Android ถาม ให้อนุญาต "ติดตั้งจากแหล่งที่ไม่รู้จัก" เฉพาะครั้งนี้)
3. เปิดแอป → กดอนุญาตสิทธิ์ **SEND_SMS** (จำเป็น) และสิทธิ์เสริมอื่น ๆ ตามต้องการ
4. ตั้งค่าแอปให้ชี้มาที่เซิร์ฟเวอร์ของเรา:
   - เปิดเมนู **Settings → Server** (หรือหน้าหลักหมวดเซิร์ฟเวอร์)
   - เลือกโหมด **Private server** แล้วกรอก:
     - **URL**: `https://<โดเมนของ Railway>/api/mobile/v1` — ใส่ตามที่แอปกำหนดในช่อง URL (ถ้าช่องต้องการโดเมนเปล่า ให้ใส่ `https://<โดเมนของ Railway>`)
     - **Token (private token)**: ค่า `SMSGATE_PRIVATE_TOKEN` ที่ตั้งไว้ใน `.env` ของ Railway
   - แนะนำให้เปิดตัวเลือกแจ้งเตือนแบบ **SSE only** (ปิด FCM) เพื่อให้คำสั่งสั่งงานไหลจากเซิร์ฟเวอร์ของเราถึงมือถือโดยตรง ไม่ผ่านเซิร์ฟเวอร์กลางของผู้พัฒนา
5. กลับหน้าหลัก → กด **Start Service** (ปุ่มล่างจอ) — สถานะต้องขึ้นเชื่อมต่อกับเซิร์ฟเวอร์ของเราสำเร็จ
6. สร้างบัญชีผู้ใช้เกตเวย์ (ใช้กับ backend ของเรา): แอปจะแสดง **username/password สำหรับ Basic auth** ในหน้าตั้งค่า — จดค่าทั้งคู่ แล้วนำไปใส่ใน `.env` ของ backend:
   ```
   SMS_GATE_URL=https://<โดเมนของ Railway>
   SMS_GATE_USER=<username จากแอป>
   SMS_GATE_PASSWORD=<password จากแอป>
   VERIFICATION_DELIVERY=sms_gateway_selfhosted
   ```

## ขั้นตอนบน Railway (หนึ่งครั้ง)

1. สร้างโปรเจกต์ใหม่ → Deploy จาก `deployments/sms-gateway/docker-compose.yml` (Railway รองรับ Docker Compose) หรือสร้าง 3 service แยก: MariaDB + server + worker ตามค่า env ในไฟล์
2. ตั้งค่า env ทั้งหมดตามหัวข้อ `SMSGATE_*` ใน `.env.example`
3. ตั้งโดเมน (Railway ให้ `*.up.railway.app`) — ผูกกับพอร์ต 3000 ของ service `backend`
4. ตรวจความพร้อม: เปิด `https://<โดเมน>/health` ต้องตอบ 200

## ทดสอบรับข้อ 14 แบบมีหลักฐาน

1. ใน dev: `VERIFICATION_DELIVERY=dev_console` → สมัครบัญชีใหม่ → โค้ดปรากฏใน log และหน้า OTP → กรอก → สำเร็จ (มีหลักฐานใน log)
2. บน Railway: ตั้ง `VERIFICATION_DELIVERY=sms_gateway_selfhosted` + `SMS_GATE_*` ครบ → สมัครด้วยเบอร์จริง → SMS มาถึงเบอร์นั้นจากซิมของคุณ → กรอกโค้ด → สมัครสำเร็จ
3. เก็บหลักฐาน: ภาพ SMS ที่เข้ามือถือปลายทาง + ล็อก `sms-gateway` บน Railway แสดงข้อความถูกส่ง (status=Sent/Delivered)

## ข้อควรระวัง

- **เครื่องต้องออนไลน์เสมอ** ถ้ามือถือหลุดเน็ต รหัสจะค้างในคิวของเซิร์ฟเวอร์จนกว่าจะกลับมาเชื่อมต่อ
- ผู้ให้บริการเคลื่อนที่อาจจำกัดจำนวน SMS/วัน — แอปมีตัวจำกัดอัตราส่งในตัว (Send rate limiting) ตั้งได้ในหน้า Settings
- โทรศัพท์ต้องไม่ปิดแอปแบบ force close — แอปมีกลไก Foreground service + reconnect (SSE ต่อใหม่เองอัตโนมัติ)
- ต่อเบอร์/เครื่องเดียวพอสำหรับเปิดตัวปริมาณน้อย ถ้าต้องการหลายเครื่อง แอปรองรับหลายเครื่องต่อบัญชีเดียว
