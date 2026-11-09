# ฟู๊ด ธันเดอร์ — FoodFlow2026

> แพลตฟอร์มสั่งอาหารออนไลน์ (Food Delivery Platform) สำหรับตลาดประเทศไทย
> อินเทอร์เฟซภาษาไทย 100% · โอเพนซอร์สทั้งหมด · ไม่พึ่งบริการเชิงพาณิชย์แบบปิด

![CI](https://github.com/armuxui3239-rgb/FoodFlow2026/actions/workflows/ci.yml/badge.svg)
![Version](https://img.shields.io/badge/version-0.1.0-FFC400)
![License](https://img.shields.io/badge/license-MIT-black)

## ภาพรวมโปรเจกต์

FoodFlow2026 คือแอปพลิเคชันลูกค้า (Customer App) ของระบบสั่งอาหาร "ฟู๊ด ธันเดอร์"
พัฒนาตามหลักวิศวกรรมซอฟต์แวร์: มีเอกสารสถาปัตยกรรม มาตรฐานโค้ด CI/CD การจัดการเวอร์ชัน
และแนวทางความปลอดภัยครบถ้วน

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

### ฟีเจอร์ปัจจุบัน

- ร้านอาหารตั้งต้น 22 ร้านในกรุงเทพฯ พร้อมเมนู ราคา รูปภาพ พิกัดจริง
- ตะกร้าสินค้า → ชำระเงิน PromptPay QR → ติดตามสถานะคำสั่งซื้อ
- กระเป๋าเงินในแอป + ระบบคูปอง/โปรโมชั่น
- รีวิวร้าน แชทฝ่ายบริการลูกค้า คูปองหน้า Offers และหน้าช่วยเหลือ FAQ 15 ข้อ
- เข้าสู่ระบบด้วยเบอร์โทร (OTP) + PIN 6 หลัก + Onboarding หลายขั้นตอน

## เริ่มต้นใช้งาน (Quick Start)

```bash
# 1) ติดตั้ง dependencies (แนะนำ Bun)
bun install

# 2) ตั้งค่า environment
cp .env.example .env
#   แก้ค่า SUPABASE_URL / SUPABASE_SERVICE_KEY / SUPABASE_ANON_KEY
#   และ SESSION_SECRET (สุ่มสตริงยาว 48+ ตัวอักษร)

# 3) รันเซิร์ฟเวอร์พัฒนา
bun run dev          # http://localhost:3000

# 4) ตรวจคุณภาพโค้ด
bun run lint
```

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
