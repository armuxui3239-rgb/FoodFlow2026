# ฟู๊ด ธันเดอร์ — FoodFlow2026

> แพลตฟอร์มสั่งอาหารออนไลน์ (Food Delivery Platform) สำหรับตลาดประเทศไทย
> อินเทอร์เฟซภาษาไทย 100% · โอเพนซอร์สทั้งหมด · ไม่พึ่งบริการเชิงพาณิชย์แบบปิด

![CI](https://github.com/armuxui3239-rgb/FoodFlow2026/actions/workflows/ci.yml/badge.svg)
![Version](https://img.shields.io/badge/version-0.5.0-FFC400)
![License](https://img.shields.io/badge/license-MIT-black)

## ภาพรวมโปรเจกต์

FoodFlow2026 คือแพลตฟอร์มสั่งอาหาร "ฟู๊ด ธันเดอร์" **ครบทั้ง 4 บทบาท** (ลูกค้า · เจ้าของร้าน · ไรเดอร์ · ผู้ดูแลระบบ)
พัฒนาตามหลักวิศวกรรมซอฟต์แวร์: มีเอกสารสถาปัตยกรรม มาตรฐานโค้ด CI/CD การจัดการเวอร์ชัน
และแนวทางความปลอดภัยครบถ้วน — ปัจจุบัน **104 หน้า + 109 API** ครบเทียบแม่แบบต้นทาง 122 จอ

### เทคโนโลยี (โอเพนซอร์สทั้งหมด)

| ส่วน | เทคโนโลยี |
|---|---|
| เฟรมเวิร์ก | Next.js 16 (App Router) + TypeScript 5 (strict) |
| UI | Tailwind CSS 4 + shadcn/ui (New York) + Lucide Icons (SVG) |
| ฐานข้อมูล | Supabase Postgres + PostGIS (เข้าถึงผ่าน REST — PostgREST) |
| Runtime | Bun |
| แผนที่ | OpenStreetMap tiles + MapLibre (ไม่ใช้ Google Maps) |
| การชำระเงิน | PromptPay QR (สร้าง payload ในระบบเอง — ไม่ใช้บริการ third party) |
| ยืนยันตัวตน | OTP 6 หลัก + PIN (ส่งผ่าน android-sms-gateway แบบ self-hosted) |

### ฟีเจอร์ปัจจุบัน (v0.5.0)

- ร้านอาหารตั้งต้น 22 ร้านในกรุงเทพฯ พร้อมเมนู 110 รายการ + ตัวเลือกขนาด/ท็อปปิ้ง รูปภาพ พิกัดจริง
- ลูกค้า: ตะกร้า → คูปอง → ชำระเงิน PromptPay QR → ติดตามสถานะ/แผนที่ GPS → รีวิว → ทิปไรเดอร์
- กระเป๋าเงินในแอป + แต้มสะสม + ระบบคูปอง/โปรโมชันเต็มรูปแบบ (สร้าง/จัดการได้ทั้งแอดมินและร้าน)
- **เจ้าของร้าน**: คลังออเดอร์ (kanban) จัดการเมนู/หมวด/ตัวเลือก โปรโมชัน รีวิว+ตอบ พนักงาน 5 บทบาท รายงาน/insights/revenue
- **ไรเดอร์**: สมัคร 3 ขั้น+KYC รับงานพร้อม GPS จริง แผนที่จุดน่ารับงาน รายได้ โบนัส ทิป บัญชีธนาคาร
- **แอดมิน**: ควบคุมออเดอร์/ร้าน/ไรเดอร์/ผู้ใช้ ตรวจ KYC คูปอง รายงาน+ส่งออกไฟล์ บันทึกการทำงาน (audit) ซัพพอร์ต ตั้งค่า 4 กลุ่ม
- เข้าสู่ระบบด้วยเบอร์โทร (OTP) + PIN 6 หลัก + Onboarding หลายขั้นตอน

## เริ่มต้นใช้งาน (Quick Start)

```bash
# 1) ติดตั้ง dependencies (แนะนำ Bun)
bun install

# 2) ตั้งค่า environment
cp .env.example .env
#   แก้ค่า SUPABASE_URL / SUPABASE_SERVICE_KEY / SUPABASE_ANON_KEY
#   และ SESSION_SECRET (สุ่มสตริงยาว 48+ ตัวอักษร)

# 3) (Supabase ใหม่เท่านั้น) สร้างตาราง + ข้อมูลตั้งต้น
#    รันไฟล์ supabase/schema.sql ใน SQL Editor ของ Supabase ก่อน
#    แล้วรัน seed: SUPABASE_URL=... SBK=... bun scripts/seed-thai.mjs

# 4) รันเซิร์ฟเวอร์พัฒนา
bun run dev          # http://localhost:3000

# 5) ตรวจคุณภาพโค้ด
bun run lint
```

### บทบาทผู้ใช้ (4 บทบาท — ประตูกันตามบทบาทใน src/proxy.ts)

| บทบาท | หน้าพอร์ทัล | ความสามารถหลัก |
|---|---|---|
| ลูกค้า (customer) | `/` | สั่งอาหาร ตะกร้า จ่ายพร้อมเพย์ ติดตาม รีวิว คูปอง กระเป๋าเงิน แต้ม |
| เจ้าของร้าน (restaurant) | `/owner` | รับ/ปฏิเสธออเดอร์ สถานะครัว จัดการเมนู ตั้งค่าร้าน สถิติยอดขาย |
| ไรเดอร์ (driver) | `/driver` | เปิด-ปิดรับงาน รับ/จัดส่ง รายได้ ประวัติงาน |
| ผู้ดูแลระบบ (admin) | `/admin` | ภาพรวมทั้งระบบ ผู้ใช้ คูปอง อนุมัติร้าน |

> บัญชีทดสอบ (seed): `{admin,driver1,restaurant1,customer1}@foodthunder.co.th` รหัสผ่าน `Food@1234`

### ตัวแปรสภาพแวดล้อม (Environment Variables)

ดูรายการครบใน `.env.example` — **ห้าม commit ไฟล์ `.env` เด็ดขาด** (อ่านเพิ่ม: [SECURITY.md](SECURITY.md))

## โครงสร้างโปรเจกต์

```
├── src/
│   ├── app/            # หน้าจอ (App Router) และ API routes
│   ├── components/     # shadcn/ui + คอมโพเนนต์ของแอป
│   ├── hooks/          # React hooks
│   └── lib/            # supabase client, session, promptpay, cart ฯลฯ
├── scripts/            # สคริปต์ seed ข้อมูลตั้งต้น (ภาษาไทย)
├── deployments/        # docker-compose: sms-gateway, calls (LiveKit)
├── docs/               # เอกสารวิศวกรรมทั้งหมด
├── tests/              # สคริปต์ทดสอบ runtime
└── examples/           # ตัวอย่าง WebSocket
```

## เอกสารวิศวกรรม (docs/)

| เอกสาร | เนื้อหา |
|---|---|
| [ENGINEERING.md](docs/ENGINEERING.md) | มาตรฐานการพัฒนา: branching, commits, versioning, release |
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | สถาปัตยกรรมระบบและการไหลของข้อมูล |
| [DATABASE.md](docs/DATABASE.md) | โครงสร้างฐานข้อมูล 62 ตาราง + สถานะข้อมูลตั้งต้น |
| [DEPLOYMENT.md](docs/DEPLOYMENT.md) | การ deploy และตัวแปรสภาพแวดล้อม |
| [ROADMAP.md](docs/ROADMAP.md) | แผนงานที่เหลือ เรียงตามลำดับความสำคัญ |
| [SECURITY.md](SECURITY.md) | นโยบายความปลอดภัยและการรายงานช่องโหว่ |
| [CONTRIBUTING.md](CONTRIBUTING.md) | วิธีมีส่วนร่วมพัฒนา |

## สถานะโปรเจกต์

เวอร์ชัน `v0.1.0` — ระบบลูกค้าใช้งานได้จริงบนฐานข้อมูลจริง
งานที่เหลือดูใน [ROADMAP.md](docs/ROADMAP.md)

## License

[MIT](LICENSE)
