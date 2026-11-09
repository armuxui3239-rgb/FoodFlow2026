# นโยบายความปลอดภัย (Security Policy)

## แนวทางปฏิบัติที่บังคับในโปรเจกต์นี้

1. **ห้าม commit ไฟล์ลับเด็ดขาด** — `.env`, คีย์ API, token, password ต้องอยู่ใน `.env`
   ซึ่งถูก gitignore ไว้แล้ว ใช้ `.env.example` เป็นแม่แบบเท่านั้น
2. **คีย์ Supabase ฝั่ง server** (`SUPABASE_SERVICE_KEY`) ต้องใช้เฉพาะในไฟล์ที่มี
   `import 'server-only'` หรือ API routes — ห้าม import เข้า client component โดยเด็ดขาด
3. ทุก commit ถูกสแกนหาความลับด้วย **gitleaks** ใน CI อัตโนมัติ
4. repository นี้ถูกสร้างจาก **clean history** — ประวัติเก่าที่เคยมี `.env` ถูกตัดทิ้งทั้งหมด
   ก่อนเผยแพร่สาธารณะ (โปรดเปลี่ยน/หมุนคีย์ใดๆ ที่เคยถูกแชร์ในช่องทางอื่น)

## การรายงานช่องโหว่

- **ห้ามเปิด Issue สาธารณะ** สำหรับช่องโหว่ที่ยังไม่ได้แก้
- ใช้ [Private vulnerability reporting](https://github.com/armuxui3239-rgb/FoodFlow2026/security/advisories/new)
  ของ GitHub หรือติดต่อผู้ดูแล repository โดยตรง
- แจ้งให้ครบ: ขั้นตอนทำซ้ำ, ผลกระทบ, ข้อเสนอแนะการแก้ (ถ้ามี)
- ตอบกลับภายใน 7 วันทำการ

## ขอบเขต (Scope)

- โค้ดใน repository นี้ (Customer App + API routes + scripts)
- การกำหนดค่า deployment ใน `deployments/`

นอกขอบเขต: ปัญหาความพร้อมใช้งานของบริการ Supabase/OSM ฝั่งผู้ให้บริการ
