# การติดตั้งและเดปลอย (Deployment Guide)

## 1. สภาพแวดล้อม (Environments)

| สภาพแวดล้อม | ฐานข้อมูล | การส่ง SMS | หมายเหตุ |
|---|---|---|---|
| development | Supabase โปรเจกต์ dev / รัน seed ใหม่ได้ | `dev_console` (พิมพ์ OTP ใน log) | ใช้เครื่องนักพัฒนา |
| production | Supabase โปรเจกต์ production | `sms_gateway_selfhosted` | ห้ามมีข้อมูลจำลอง |

## 2. ตัวแปรสภาพแวดล้อมที่ต้องมี (บังคับ 5 ค่า)

ดูแม่แบบใน `.env.example`:

| ตัวแปร | ใช้ทำอะไร | ใครมองเห็นได้ |
|---|---|---|
| `DATABASE_URL` | Prisma (เศษเทมเพลต) | server |
| `SESSION_SECRET` | ลงลายเซ็น session cookie | server เท่านั้น |
| `SUPABASE_URL` | ที่อยู่ PostgREST | server |
| `SUPABASE_SERVICE_KEY` | คีย์เข้าถึงทุกตาราง | server เท่านั้น (server-only) |
| `SUPABASE_ANON_KEY` | คีย์สาธารณะ (ถ้ามีโอเพ่น endpoint) | ได้ทุกฝั่ง |

กฎ: ตั้งค่าผ่าน dashboard ของแพลตฟอร์ม deploy (Vercel/Railway) — **ห้าม commit ไฟล์ .env**

## 3. แผนการเดปลอย (Production Topology)

```
Vercel:  Customer App (repo นี้) · Admin Portal · Restaurant Portal
Railway: บริการเสริมที่ต้องมี process ค้าง (job runner, SMS gateway)
Docker:  deployments/sms-gateway  ·  deployments/calls (LiveKit — ปิด flag)
```

### 3.1 SMS Gateway (self-hosted, โอเพนซอร์ส)
```bash
cd deployments/sms-gateway
docker compose up -d        # server + MySQL
```
- App API URL ต้องเต็ม: `https://<โดเมน>/api/mobile/v1`
- เอกสารฉบับเต็ม: `SMS_GATEWAY_ANDROID_TH.md`

### 3.2 โทร/วิดีโอ (LiveKit + coturn)
- โค้ดและ compose พร้อมที่ `deployments/calls/`
- **สถานะ: ปิด feature flag** — เปิดเมื่อมีเซิร์ฟเวอร์จริง (แสดงข้อความ "ยังไม่เปิดใช้งาน" ในแอป)

## 4. ขั้นตอนเดปลอย Customer App (Vercel)

1. Fork/clone repo → เชื่อมกับ Vercel project ใหม่
2. ตั้ง Environment Variables ตามข้อ 2 ครบทั้ง 5 ค่า
3. Build command: `bun run build` (Vercel จัดการเอง) — อย่ารัน build ในเครื่อง dev
4. เสร็จแล้วทดสอบ: `/api/restaurants` ต้องตอบ 200 และมีข้อมูลร้านจริง

## 5. การตรวจหลังเดปลอย (Post-deploy Checklist)

- [ ] `/api/restaurants`, `/api/menu/popular`, `/api/promotions` ตอบ 200
- [ ] เข้าสู่ระบบ OTP ได้จริง (ช่องทางตาม env)
- [ ] สร้างออเดอร์ → QR พร้อมเพย์แสดง → ยอดถูกต้อง (สตางค์)
- [ ] แผนที่โหลด tiles ได้ + มี attribution OSM
- [ ] ไม่มีคีย์ service ปรากฏใน HTML/JS ที่ส่งถึง client

## 6. การกู้คืน (Rollback)

- Vercel: เลือก deployment ก่อนหน้า → "Promote to Production" (ทันที ไม่ต้อง build ใหม่)
- ฐานข้อมูล: แก้สคีมาทุกครั้งต้องมี SQL script ที่รันย้อนได้ใน `deployments/sql/`
