# คู่มือสำรองข้อมูลและกู้คืน (Backup & Restore) — ฟู๊ด ธันเดอร์

> เป้าหมาย: ข้อมูลระบบ (ร้าน 24 · ผู้ใช้ · ออเดอร์ · กระเป๋าเงิน · แต้ม) **หายไม่ได้** — กู้คืนได้จริง
> อัปเดต 2026-11-15 · ใช้กับแผน Supabase ฟรี (ยังไม่มี backup อัตโนมัติของผู้ให้บริการให้พึ่งได้เต็มที่)

## 1. สำรองอะไรบ้าง

| อะไร | อยู่ที่ไหน | วิธีสำรอง |
|---|---|---|
| **ฐานข้อมูลทั้งหมด** (ตาราง/ข้อมูล จำเป็นที่สุด) | Supabase Postgres | `pg_dump` ด้วย `DIRECT_URL` — ดูข้อ 2 |
| โค้ด + เอกสารทั้งหมด | GitHub (armuxui3239-rgb/FoodFlow2026) | มีอยู่แล้วทุก commit + CI |
| ไฟล์สลิปเติมเงิน (รูป) | Supabase Storage bucket `topup-slips` (private) | Supabase Studio → Storage → เลือกไฟล์ดาวน์โหลด (นาน ๆ ครั้ง หรือเมื่อสลิปเยอะ) |
| ตัวแปรสภาพแวดล้อม | .env ในเครื่อง + Vercel | เก็บสำเนา .env ในที่ปลอดภัย (รหัสผ่านเครื่อง) — **ห้าม commit** |

## 2. สำรองฐานข้อมูล (ทำทุกสัปดาห์ — หรือก่อนแก้ระบบใหญ่ทุกครั้ง)

เปิด Git Bash ในโฟลเดอร์โปรเจกต์ แล้วรัน (ค่าจะดึงจาก .env ให้เอง):

```bash
export $(grep -E "^DIRECT_URL=" .env | tr -d '\r')
STAMP=$(date +%Y%m%d)
pg_dump "$DIRECT_URL" \
  --schema=public --no-owner --no-privileges \
  --file "backups/foodthunder-$STAMP.sql"
```

- ผลลัพธ์: ไฟล์ `backups/foodthunder-YYYYMMDD.sql` (ข้อความ อ่านได้ กู้คืนได้)
- โฟลเดอร์ `backups/` ถูก gitignore แล้ว — **เก็บไฟล์นี้ที่อื่นด้วย** (เมล์ตัวเอง / แฟลชไดรฟ์ / Google Drive) อย่างน้อย 2 ที่
- แนะนำเก็บย้อนหลัง 4 สัปดาห์ แล้วลบไฟล์เก่าทิ้ง

> ตรวจว่าไฟล์สมบูรณ์: เปิดดูท้ายไฟล์ต้องมีบรรทัด `-- PostgreSQL database dump complete`

## 3. กู้คืน (เมื่อเกิดเหตุ — ทำตามลำดับ)

1. **ฐานข้อมูลใหม่**: Supabase → สร้างโปรเจกต์ใหม่ (หรือใช้โปรเจกต์เดิมถ้าเพียงข้อมูลหาย) → ตั้งรหัสใหม่
2. **สร้างโครงสร้าง+ข้อมูลจากไฟล์สำรอง**:

```bash
export $(grep -E "^DIRECT_URL=" .env | tr -d '\r')   # ชี้ไปฐานใหม่
psql "$DIRECT_URL" -f backups/foodthunder-YYYYMMDD.sql
```

3. **ส่วนเสริมที่ไม่มากับ dump** (ถ้ากู้คืนลงโปรเจกต์ใหม่):
   - ส่วนขยาย: PostGIS / pgcrypto / vector — SQL Editor: `CREATE EXTENSION IF NOT EXISTS postgis; CREATE EXTENSION IF NOT EXISTS pgcrypto;`
   - enum `LocaleCode` ต้องมี `'th'`: รัน `deployments/sql/add_th_locale.sql`
4. **อัปเดตคีย์ใหม่** ลง `.env` + Vercel (SUPABASE_URL / SERVICE_KEY / DATABASE_URL) แล้วระบบกลับมาใช้ได้ทันที
5. **ตรวจหลังกู้คืน**: `node scripts/audit-db-truth.mjs` (ร้าน 24 · เมนู 192 · แต้มมีข้อมูล) + `bash scripts/qa-all.sh`

## 4. จังหวะที่ต้องสำรอง "บังคับ"

- ก่อนแก้ SQL/โครงสร้างฐานข้อมูลทุกครั้ง (deployments/sql)
- ก่อนเปลี่ยน Supabase โปรเจกต์ / ย้ายผู้ให้บริการ
- ทุกสัปดาห์เป็นกิจวัตร (แนะนำวันอาทิตย์)

## 5. จุดจำกัดที่ควรรู้ (พูดตรง ๆ)

- แผนฟรี Supabase ไม่มี backup อัตโนมัติที่เชื่อถือได้ → **รอบนี้คุณคือระบบ backup** — ตั้งเตือนในมือถือทุกสัปดาห์
- เมื่ออัปเกรดแผน Pro ภายหลัง: เปิด **Point-in-Time Recovery (PITR)** ได้ → กู้ย้อนเวลาได้ถึงทุกนาที
- ไฟล์สลิปใน Storage ถ้าหาย = รูปหายเท่านั้น (ข้อมูลเติมเงิน/อนุมัติ ยังอยู่ในฐานข้อมูล)
