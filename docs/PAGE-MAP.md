# ผังหน้าใช้งานทั้งระบบ (Page Map) — ฟู๊ด ธันเดอร์ FoodFlow2026

> หลักการ: ทุกหน้าต้อง "พร้อมใช้งานจริง" — ผูก API/ฐานข้อมูลจริง ไม่มีหน้าโชว์
> อัปเดต 2026-11-14 (หมวด D ครบ): นับจากไฟล์จริง `find src/app -name page.tsx` = **109 หน้า** + 136 API routes (เพิ่มจาก 0.6.0: จัดการคืนเงิน / เวรพนักงาน / payout ไรเดอร์ / ท่อเหตุการณ์ outbox)
> ยืนยันครบเทียบแม่แบบต้นทาง 122 จอ (web 70 + mobile 52) — ทุกจอมีของเทียบเท่า (บางจอรวมเป็นหน้าเดียว เช่น login รวมศูนย์, chat→messages, vouchers→offers, loyalty→points)
> แหล่งอ้างอิง: `_template-ref/FoodDelivery_App` (โอเพนซอร์ส MIT)

## สถานะ: ✅ พร้อมใช้แล้ว (curl 200 + API จริง + qa-all.sh 5 ชุด 120 จุดผ่าน + เฟส 9 ความปลอดภัยเสร็จ + หมวด D ครบ)

## เฟส 1 — ลูกค้า (Customer) 41 หน้า

| หน้า | เส้นทาง | สถานะ |
|---|---|---|
| ออนบอร์ด 7 จอ (สไลด์/โปรไฟล์/แผนที่/แจ้งเตือน/PIN/ไบโอ/ยินดีต้อนรับ) | /onboarding/intro · profile · location · notification · pin · biometric · welcome | ✅ |
| สมัคร/ล็อกอิน/OTP/ลืม PIN | /register · /login · /verify-otp · /forgot-pin | ✅ |
| หน้าแรก (ร้านแนะนำ + โปรโมชัน + ค้นหา) | / | ✅ |
| ร้านทั้งหมด + ร้านเดี่ยว + ตัวกรอง + ค้นหา | /restaurants · /restaurants/[id] · /restaurants/filters · /search | ✅ |
| รายละเอียดเมนู + ตัวเลือก (ขนาด/ท็อปปิ้ง) | /food/[id] | ✅ |
| ตะกร้า → ชำระเงิน PromptPay (คูปอง) | /cart · /checkout | ✅ |
| ออเดอร์ / รายออเดอร์ / ติดตาม / แผนที่ / รีวิว | /orders · /orders/[id] · /tracking · /map · /rate | ✅ |
| ทิปไรเดอร์ | ใน /orders/[id] (delivered/completed) | ✅ |
| กระเป๋าเงิน + เติมเงิน | /wallet · /wallet/topup | ✅ |
| แต้มสะสม / ข้อเสนอ / เชิญเพื่อน | /points · /offers · /invite | ✅ |
| ที่อยู่ / ร้านโปรด / แชท / แจ้งเตือน | /addresses · /favorites · /messages · /messages/[id] · /notifications | ✅ |
| ช่วยเหลือ / ภาษา / โปรไฟล์ / ตั้งค่า | /help · /language · /profile · /profile/edit · /settings · /settings/notifications · /settings/security | ✅ |

## เฟส 2 — เจ้าของร้าน (Restaurant) 20 หน้า

| หน้า | เส้นทาง | สถานะ |
|---|---|---|
| แดชบอร์ด (สถิติวันนี้ + คิวออเดอร์ 4 ช่วง + ปุ่ม action) | /owner | ✅ |
| คลังออเดอร์ (kanban 4 คอลัมน์) + รายละเอียดออเดอร์ | /owner/orders · /owner/orders/[id] | ✅ |
| เมนู: กระดานเปิด/ปิดขาย · สร้าง · แก้ไข · หมวดหมู่ | /owner/menu · menu/new · menu/[id]/edit · menu/categories | ✅ |
| โปรโมชัน: รายการ · สร้าง · รายละเอียด+สถิติ · แก้ไข | /owner/promotions · new · [id] · [id]/edit | ✅ |
| รีวิว + ตอบรีวิว | /owner/reviews | ✅ |
| แจ้งเตือนร้าน | /owner/notifications | ✅ |
| พนักงาน + เชิญผ่านลิงก์ (5 บทบาท) | /owner/staff | ✅ |
| analytics · insights · revenue (กำไร/ค่าคอม/จ่ายไรเดอร์) | /owner/analytics · /owner/insights · /owner/revenue | ✅ |
| ตั้งค่าร้าน (เปิด-ปิด/เวลา/ขั้นต่ำ) + โปรไฟล์ร้าน | /owner/settings · /owner/settings/profile | ✅ |
| สถิติยอดขาย 7 วัน | /owner/stats | ✅ |

## เฟส 3 — ไรเดอร์ (Driver) 17 หน้า

| หน้า | เส้นทาง | สถานะ |
|---|---|---|
| งานของฉัน (เปิดรับ + GPS ส่งพิกัดทุก 15 วิ + ลิงก์ทริป) | /driver | ✅ |
| สมัครไรเดอร์ 3 ขั้น (ข้อตกลง → ยานพาหนะ → เอกสาร) | /driver/onboarding/agreement · vehicle · documents | ✅ |
| KYC + สถานะอนุมัติ | /driver/kyc | ✅ |
| งานที่รับ (แผนที่เส้นทาง + รายงานทิป) | /driver/trips/[id] | ✅ |
| รายได้ / ประวัติ / โบนัสแคมเปญ / คะแนน / ทิป | /driver/earnings · history · incentives · ratings · tips | ✅ |
| แผนที่จุดน่ารับงาน (heatmap) | /driver/heatmap | ✅ |
| บัญชีธนาคาร + RESTful [id] | /driver/bank (+ API) | ✅ |
| โปรไฟล์ / แจ้งเตือน / ซัพพอร์ต / ตั้งค่า | /driver/profile · notifications · support · settings | ✅ |

## เฟส 4 — ผู้ดูแลระบบ (Admin) 26 หน้า

| หน้า | เส้นทาง | สถานะ |
|---|---|---|
| ศูนย์ควบคุม (KPI + ออเดอร์ + ร้าน) | /admin | ✅ |
| ออเดอร์: รายการ (กรอง/ค้นหา/วันที่) + รายละเอียด (เปลี่ยนสถานะครบ + audit log) | /admin/orders · /admin/orders/[id] | ✅ |
| ร้าน: รายการ + รายละเอียด (ควบคุมครบ + audit) | /admin/restaurants · /admin/restaurants/[id] | ✅ |
| ไรเดอร์: รายการ (สถิติ/ตัวกรอง) + รายละเอียด (ตรวจ KYC + อนุมัติ/ปฏิเสธ) + แผนที่สด | /admin/drivers · [id] · drivers/map | ✅ |
| ผู้ใช้: รายการ + รายละเอียด (ระงับ/เปิด + audit) | /admin/users · [id] | ✅ |
| คูปอง: รายการ · สร้าง · รายละเอียด+สถิติ · แก้ไข | /admin/promotions · new · [id] · [id]/edit | ✅ |
| รายงาน 7/30/90 วัน (CSV) + งานส่งออกไฟล์จริง | /admin/reports · /admin/export-jobs | ✅ |
| บันทึกการทำงาน (audit logs + CSV) | /admin/logs | ✅ |
| ซัพพอร์ต: คิว + ตั๋ว (แชท/แมโคร/สถานะ) | /admin/support · /admin/support/[id] | ✅ |
| ตั้งค่า: รวม · แบรนด์ · ข้อกำหนด/PDPA · การเชื่อมต่อ | /admin/settings · settings/branding · settings/compliance · settings/integrations | ✅ |
| วิเคราะห์ + AI monitor | /admin/analytics · /admin/ai-monitor | ✅ |
| จัดการคืนเงิน (ลูกค้าขอคืน → อนุมัติเงินเข้ากระเป๋า/ปฏิเสธ + audit) | /admin/refunds | ✅ (D1) |

## ✅ หมวด D ตาม REMAINING-WORK.md — เสร็จครบ (2026-11-14)

- **D1** ระบบคืนเงิน ✅ (commit 4701663) · **D3** dispatch เสนองานอัตโนมัติ ✅ (d556b3e) · **D4 เวรพนักงาน + D5 payout + D6 ประวัติพิกัด + D7 outbox** ✅ (4c8a8fd)
- **D2 FCM** — ยกเลิกตามนโยบายจบในระบบ (แจ้งเตือนในแอป + realtime_outbox แทน) · **D8 LiveKit** — ใช้ WebRTC P2P ในระบบอยู่ (รอเซิร์ฟเวอร์เจ้าของเฉพาะกรณีจะเปิด)
- เหลือนอกหมวด D: ระบบสะสมแต้มตอนสั่งซื้อ (ROADMAP P1) · ทดสอบโหลดบริการโอเพนซอร์ส (P2) — รอคำสั่ง

## กติกา

1. เพิ่มหน้าใหม่ต้องอัปเดตตารางนี้ทุกครั้ง พร้อม commit
2. หน้าไหนยังไม่มีข้อมูลจริงมาเลย → ไปเฟสถัดไป ห้ามทำหน้าลอย
3. ทุกหน้าที่ "✅" ต้องผ่านการตรวจจริง (curl + เบราว์เซอร์) ก่อน push เสมอ
   — รอบนี้ตรวจ curl 200 ครบหน้ารายการ/API; หน้ารายละเอียด (มี [id]) ผ่านการคอมไพล์ + API ตรวจแล้ว ให้ทดสอบบนเบราว์เซอร์ก่อน push จริง
