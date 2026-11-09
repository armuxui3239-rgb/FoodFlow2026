# แนวทางการมีส่วนร่วมพัฒนา (Contributing Guidelines)

ขอบคุณที่สนใจพัฒนา FoodFlow2026 โปรดอ่านมาตรฐานนี้ก่อนส่งโค้ด
รายละเอียดฉบับเต็มอยู่ที่ [docs/ENGINEERING.md](docs/ENGINEERING.md)

## การตั้งสภาพแวดล้อม

```bash
git clone https://github.com/armuxui3239-rgb/FoodFlow2026.git
cd FoodFlow2026
bun install
cp .env.example .env   # ใส่ค่าจริงเฉพาะเครื่องคุณ
bun run dev
```

## กฎเหล็ก 6 ข้อ

1. **ทุกงานเริ่มจาก branch ใหม่** ตั้งชื่อตามแบบแผน (ด้านล่าง) — ห้าม push ตรงเข้า `main`
2. **Commit ตาม Conventional Commits** — `type(scope): subject` เช่น
   `feat(cart): เพิ่มตัวเลือกหมายเหตุต่อรายการ`, `fix(api): ตรวจสอบยอดขั้นต่ำก่อนสร้างออเดอร์`
3. **`bun run lint` ต้องผ่านก่อนเปิด PR** — CI จะปฏิเสธ PR ที่ lint ไม่ผ่าน
4. **ห้าม commit ไฟล์ลับ** — `.env` ถูก ignore แล้ว และมี gitleaks ตรวจใน CI
5. **ภาษาไทยสำหรับข้อความผู้ใช้ปลายทาง** ทั้งหมด (UI strings), โค้ด/ตัวแปร/คอมเมนต์เทคนิคเป็นภาษาอังกฤษ
6. **อ้างอิง Issue** ใน PR ทุกครั้ง (`Closes #123`) เพื่อให้ trace ย้อนได้

## รูปแบบชื่อ branch

| ประเภทงาน | รูปแบบ | ตัวอย่าง |
|---|---|---|
| ฟีเจอร์ใหม่ | `feature/<เรื่อง>` | `feature/coupon-checkout` |
| แก้บั๊ก | `fix/<เรื่อง>` | `fix/restaurant-coords` |
| เอกสาร | `docs/<เรื่อง>` | `docs/database-guide` |
| คุณภาพโค้ด | `refactor/<เรื่อง>` | `refactor/cart-server` |

## กระบวนการ PR

1. Rebase บน `main` ล่าสุด → แก้ conflict ก่อนขอ merge
2. กรอกเทมเพลต PR ให้ครบ: สิ่งที่เปลี่ยน / วิธีทดสอบ / ภาพหน้าจอ (ถ้าเป็น UI)
3. CI (lint + gitleaks) ต้องผ่านทุก check
4. ผู้ดูแล 1 คน review แล้ว squash merge เข้า `main`

## การแปล (i18n)

ข้อความในแอปเป็นภาษาไทยทั้งหมด ปัจจุบันเก็บ inline ในหน้าจอ
ห้ามใช้เครื่องหมาย emoji เป็นไอคอน — ใช้ Lucide SVG ผ่าน `lucide-react` เท่านั้น
