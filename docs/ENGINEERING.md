# มาตรฐานวิศวกรรมซอฟต์แวร์ (Engineering Standards)

เอกสารนี้กำหนดกฎที่ทีมทุกคนต้องปฏิบัติ — ตัดสินใจยากให้กลับมาอ่านที่นี่ก่อน

## 1. การจัดการเวอร์ชัน (Versioning)

ใช้ **Semantic Versioning** `MAJOR.MINOR.PATCH`

| เมื่อไร | ขึ้นเวอร์ชัน | ตัวอย่าง |
|---|---|---|
| เปลี่ยน API/สคีมาในแบบที่ทำของเดิมพัง | MAJOR | `1.0.0 → 2.0.0` |
| เพิ่มฟีเจอร์แบบ backward-compatible | MINOR | `0.1.0 → 0.2.0` |
| แก้บั๊ก / ปรับปรุงเล็กน้อย | PATCH | `0.1.0 → 0.1.1` |

- ทุกเวอร์ชัน release ต้องมี: git tag `v<เวอร์ชัน>` + รายการใน `CHANGELOG.md` + GitHub Release
- ระหว่างพัฒนา (< 1.0.0) ถือว่า API อาจเปลี่ยนได้ — ระบุชัดใน changelog

## 2. กลยุทธ์ branch (Branching Strategy)

ใช้ **GitHub Flow** (เหมาะกับโปรเจกต์ขนาดเล็ก–กลาง, deploy บ่อย):

```
main ──────●────●────●──→  (ทุก commit บน main ต้อง deploy ได้เสมอ)
            \    \
feature/x    ●──●─┘
fix/y          ●─┘
```

- `main` = สาขาหลัก ป้องกัน force-push และการลบ
- งานทุกชิ้นอยู่บน branch ใหม่: `feature/`, `fix/`, `docs/`, `refactor/`, `chore/`
- รวมเข้า `main` ผ่าน PR เท่านั้น (CI ผ่านก่อน merge)
- ห้ามมี branch ค้างยาวเกิน ~5 วันโดยไม่ rebase

## 3. ข้อความ commit (Conventional Commits)

รูปแบบ: `type(scope): subject`

| type | ใช้เมื่อ |
|---|---|
| `feat` | เพิ่มฟีเจอร์ใหม่ |
| `fix` | แก้บั๊ก |
| `docs` | เอกสารเท่านั้น |
| `refactor` | ปรับโค้ดไม่เปลี่ยนพฤติกรรม |
| `chore` | งานบ้าน (config, deps, build) |
| `test` | เพิ่ม/แก้การทดสอบ |
| `perf` | ปรับปรุงประสิทธิภาพ |
| `ci` | แก้ pipeline/CI |

กฎ: subject ความยาว ≤ 72 ตัวอักษร, 1 commit = 1 เรื่อง,
ห้าม commit โค้ดที่ lint ไม่ผ่านเข้า `main`

## 4. ประตูคุณภาพ (Quality Gates)

งานจะถือว่า "เสร็จ" เมื่อครบทุกข้อ:

1. `bun run lint` ผ่าน 0 error
2. TypeScript strict ผ่าน (ไม่มี `any` ใหม่โดยไม่มีเหตุผลเขียนไว้)
3. หน้าจอที่แตะต้อง UI ทดสอบบนมือถือ (375px) และเดสก์ท็อปจริง
4. ข้อความผู้ใช้เป็นภาษาไทย 100% — ไอคอนใช้ Lucide SVG ห้ามใช้ emoji เป็นไอคอน
5. ไม่มี hard-code URL/คีย์ — ตัวแปรสภาพแวดล้อมผ่าน `process.env` เท่านั้น
6. คีย์ service ปรากฏเฉพาะฝั่ง server (`server-only` / API routes)

## 5. CI/CD

- **CI**: GitHub Actions รันทุก push และ PR — `lint` + `gitleaks` (สแกนความลับ)
- **Deploy** (ตามแผน): App ลูกค้า/แอดมิน/ร้าน → Vercel, บริการเสริม → Railway/Docker
  รายละเอียดใน [DEPLOYMENT.md](DEPLOYMENT.md)
- main ที่ผ่าน merge = deploy ได้เสมอ (keep main green)

## 6. การจัดการความลับ (Secrets Policy)

- `.env` ถูก gitignore — ใช้ `.env.example` เป็นแม่แบบ
- gitleaks บล็อก commit ที่มีรูปแบบคีย์อัตโนมัติ
- คีย์ที่เคยแชร์ในช่องทางใดก็ตาม (แชท, อีเมล) ถือว่า "หมดอายุ" ต้องหมุน (rotate) ทันที
- repository นี้เปิดสาธารณะ — ถือว่าทุกไบต์ที่ push คนทั้งโลกอ่านได้

## 7. ฐานข้อมูลและข้อมูลตั้งต้น (Data Policy)

- สคีมาอยู่บน Supabase (Postgres) — เอกสารสรุปใน [DATABASE.md](DATABASE.md)
- ข้อมูลตั้งต้นทั้งหมดต้องมาจากสคริปต์ใน `scripts/seed-*.mjs` — **ห้ามเก็บไฟล์ .db ลง repo**
- สคริปต์ seed ต้องอ่านคีย์จาก env (`SBK` หรือ `SUPABASE_SERVICE_KEY`) ไม่ hard-code
- แก้สคีมา production ต้องมี: SQL script ใน `deployments/sql/` + บันทึกใน changelog

## 8. เอกสาร (Documentation as Code)

ทุกเอกสารอยู่ใน repo อัปเดตพร้อมโค้ดใน PR เดียวกัน:

| เอกสาร | เจ้าของหลัก | อัปเดตเมื่อ |
|---|---|---|
| README.md | ทุกคน | เพิ่มฟีเจอร์/เปลี่ยนวิธีติดตั้ง |
| docs/ARCHITECTURE.md | ผู้ออกแบบระบบ | เปลี่ยนสถาปัตยกรรม |
| docs/DATABASE.md | ผู้ดูแลข้อมูล | เพิ่ม/แก้ตาราง |
| CHANGELOG.md | ผู้ release | ทุกครั้งก่อน tag |
| docs/ROADMAP.md | ผู้จัดการโปรเจกต์ | ทบทวนสัปดาห์ละครั้ง |

## 9. การทบทวนโค้ด (Code Review)

- PR ทุกใบต้องมีผู้รีวิว ≥ 1 คนที่ไม่ใช่ผู้เขียน
- เกณฑ์รีวิว: ความถูกต้อง > ความอ่านง่าย > ประสิทธิภาพ
- คอมเมนต์แบ่งระดับ: `blocker:` (ต้องแก้), `nit:` (แก้ได้ตามสะดวก), `question:` (ขอคำอธิบาย)
- squash merge — ประวัติบน main เห็น 1 commit ต่อ 1 PR

## 10. การทดสอบและการตรวจจริง

- ก่อนปิดงาน UI: ตรวจการทำงานจริงด้วยเบราว์เซอร์ (เปิดหน้า กดปุ่ม ส่งฟอร์ม)
- ข้อมูลที่แสดงต้องมาจาก API จริง — ห้ามแสดง mock แล้วเรียกว่าเสร็จ
- บั๊กที่พบหลัง merge: เปิด Issue + แก้ด้วย commit `fix:` อ้างอิง Issue นั้น
