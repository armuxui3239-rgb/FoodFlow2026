# ฐานข้อมูล (Database Reference)

ฐานข้อมูลจริง: **Supabase Postgres + PostGIS** เข้าถึงผ่าน PostgREST (REST)
สถิติจากการตรวจนับจริง ณ วันที่ 2026-11-09 (นับทุกตารางด้วย `count=exact`)

## 1. ภาพรวม

- ตารางแอป 62 ตาราง + ระบบ PostGIS 3 ตาราง
- มีข้อมูลตั้งต้น 26 ตาราง / ว่าง 36 ตาราง (งานที่เหลือดู ROADMAP)
- เงินทุกตารางเก็บหน่วย **สตางค์** (integer) — ฿1.00 = 100
- พิกัดใช้ `geography(Point,4326)`

## 2. ตารางตามโดเมน

### โดเมนร้านอาหารและเมนู
| ตาราง | แถว | คำอธิบาย |
|---|---|---|
| restaurants | 22 | ร้านอาหาร (ชื่อ ที่อยู่ พิกัด สถานะอนุมัติ) |
| categories | 88 | หมวดเมนูต่อร้าน (4 ต่อร้าน) |
| menu_items | 110 | รายการอาหาร (รูป ราคา คำอธิบาย) |
| menu_item_options | 0 | กลุ่มตัวเลือก (ขนาด/ท็อปปิ้ง) — **ยังไม่ seed** |
| menu_item_option_values | 0 | ค่าตัวเลือก + ราคาเพิ่ม — **ยังไม่ seed** |
| restaurant_opening_hours | 56 | เวลาเปิด-ปิด — **มีแค่ 8/22 ร้าน** |
| restaurant_holiday_closures | 0 | ปิดพิเศษตามวันหยุด |

### โดเมนผู้ใช้และบัญชี
| ตาราง | แถว | คำอธิบาย |
|---|---|---|
| users | 27 | บัญชีทุกบทบาท (role: customer/driver/restaurant/admin) |
| customer_profiles | 10 | โปรไฟล์ลูกค้า + ที่อยู่ default |
| driver_profiles | 5 | โปรไฟล์ไรเดอร์ (ยานพาหนะ คะแนน พิกัดปัจจุบัน) |
| restaurant_profiles | 8 | บัญชีเจ้าของ/พนักงานร้าน — **ครอบคลุมแค่ 8/22 ร้าน** |
| addresses | 8 | ที่อยู่จัดส่ง (label + geography) |
| otp_codes | 11 | รหัส OTP (hash + หมดอายุ + นับครั้ง) |
| password_reset_tokens | 0 | token ตั้งรหัสใหม่ |
| email_verification_tokens | 0 | token ยืนยันอีเมล |
| referral_codes | 1 | โค้ดเชิญเพื่อน |
| referral_redemptions | 0 | บันทึกการใช้โค้ดเชิญ |

### โดเมนคำสั่งซื้อ
| ตาราง | แถว | คำอธิบาย |
|---|---|---|
| carts / cart_items | 0 | ตะกร้า (runtime — สร้างเมื่อผู้ใช้ใช้งาน) |
| orders | 17 | คำสั่งซื้อ (สถานะ + ยอดเงิน + ค่าส่ง + ส่วนลด) |
| order_items | 20 | รายการในออเดอร์ (snapshot ชื่อ/ราคา ณ เวลาสั่ง) |
| order_status_history | 28 | ประวัติสถานะทุกการเปลี่ยนแปลง |
| payments | 13 | การชำระเงิน (method: promptpay/cash) |
| payment_intents | 4 | เจตนาชำระเงินก่อนยืนยัน |
| payment_refund_requests | 0 | คำขอคืนเงิน |
| payment_webhook_receipts | 0 | กำแพงกัน replay webhook |
| reviews | 17 | รีวิวอาหาร+การส่ง (ดาว 1–5 + คอมเมนต์ + reply) |
| delivery_tasks | 0 | งานจัดส่ง (ผูกกับไรเดอร์) |
| dispatch_offers | 0 | ข้อเสนองานไปยังไรเดอร์ |
| driver_location_history | 0 | บันทึกพิกัดไรเดอร์ย้อนหลัง |
| driver_tip_reports | 0 | รายงานทิป |

### โดเมนโปรโมชั่นและสะสมแต้ม
| ตาราง | แถว | คำอธิบาย |
|---|---|---|
| promotions | 6 | คูปอง (THUNDER30, WELCOME20, FREESHIP, SUMMER50, COMBO15, MORNING25) |
| promotion_items | 0 | คูปองผูกเมนูเฉพาะ |
| promotion_usages | 0 | บันทึกการใช้คูปองต่อผู้ใช้ |
| loyalty_transactions | 0 | สะสมแต้ม |

### โดเมนกระเป๋าเงินและบัญชีไรเดอร์
| ตาราง | แถว | คำอธิบาย |
|---|---|---|
| wallet_transactions | 2 | เข้า/ออกกระเป๋า (credit/debit, สตางค์) |
| payout_ledger | 0 | บัญชีโอนเงินให้ร้าน/ไรเดอร์ |
| driver_bank_accounts | 0 | บัญชีธนาคารไรเดอร์ |
| driver_kyc_submissions | 0 | ยืนยันตัวตนไรเดอร์ |
| driver_incentive_campaigns | 0 | แคมเปญจูงใจไรเดอร์ |

### โดเมนแชท แจ้งเตือน ซัพพอร์ต
| ตาราง | แถว | คำอธิบาย |
|---|---|---|
| chat_sessions | 3 | แชทลูกค้า↔ร้าน และ AI support |
| chat_messages | 7 | ข้อความแชท |
| notifications | 5 | แจ้งเตือนในแอป |
| notification_settings | 3 | ตั้งค่าช่องทางแจ้งเตือนต่อ event |
| user_fcm_tokens / fcm_token_revocations | 0 | token แจ้งเตือน push |
| ai_support_tickets | 1 | ตั๋วซัพพอร์ตจาก AI |
| support_ticket_messages | 0 | ข้อความในตั๋ว |
| support_macros | 0 | ข้อความตอบสำเร็จรูปของ CS |
| support_csat_responses | 0 | ผลสำรวจความพึงพอใจ |
| rag_documents | 0 | ฐานความรู้ FAQ/AI (embedding) |

### โดเมนระบบหลังบ้าน
| ตาราง | แถว | คำอธิบาย |
|---|---|---|
| platform_settings | 0 | config ระบบแบบ key-value |
| admin_audit_logs | 0 | บันทึกการกระทำของแอดมิน |
| admin_export_jobs | 0 | งาน export ข้อมูล |
| staff_shifts / staff_invites | 0 | กะทำงาน/เชิญพนักงานร้าน |
| job_outbox | 3 | คิวงานพื้นหลัง (order-timeout) |
| realtime_outbox | 0 | คิว broadcast realtime |
| idempotency_requests | 0 | กันส่งคำขอซ้ำ |
| ai_usage_events | 0 | บันทึกการใช้ AI |

## 3. สคีมาตารางหลัก (คอลัมน์สำคัญ)

### restaurants
`id, name, slug, description, logo_url, cover_url, location(geography),
address_line, city, district, phone, cuisine_types[], price_range($/$$/$$$),
rating, total_reviews, is_open, is_active, prep_time_avg_minutes,
min_order_amount, approval_status(pending/approved/changes_requested/rejected/suspended), onboarding_state`

### orders
`id, order_code, customer_id→users, restaurant_id→restaurants, driver_id→users,
delivery_address_id→addresses, status, subtotal, delivery_fee, promotion_discount,
total, payment_method, notes, estimated_prep_time_minutes,
actual_delivery_time_minutes, cancelled_reason, commission_rate_at_order_time,
route_polyline, route_waypoints`

สถานะที่ระบบใช้จริงปัจจุบัน: `created → pending_payment → paid → restaurant_pending →
(ทางไป) delivered/completed` + `cancelled`
(สถานะระหว่างทาง preparing/assigning/delivering รอเปิดตาม ROADMAP P0-4)

### promotions
`code, type(percentage/fixed), value, min_order_amount, max_discount,
usage_limit, usage_count, current_usage_count, starts_at, expires_at,
is_active, status, first_order_only, restaurant_id, is_stackable, budget, targeting`

## 4. กฎความสมบูรณ์ที่ตรวจแล้ว (ต้องรักษาไว้)

1. ไม่มี orphan: order_items→orders, payments→orders, reviews→orders,
   menu_items→categories→restaurants, addresses→users, profiles→users ตรวจครบ = 0
2. รีวิวได้เฉพาะออเดอร์ delivered/completed (ตรวจใน API)
3. เงิน = สตางค์ integer ทุกตาราง
4. การเปลี่ยนสถานะออเดอร์ทุกครั้งต้องเขียน order_status_history

## 5. ช่องว่างข้อมูลตั้งต้นที่รู้ตัว (ตาม audit 2026-11-09)

รายการเต็มอยู่ใน [ROADMAP.md](ROADMAP.md) สรุปสั้น:
พิกัด 8 ร้านผิดประเทศ, เวลาเปิด 14 ร้านขาด, หมวดว่าง 52/88,
ไม่มีออเดอร์จบวงจร, locale ผู้ใช้ไม่มี th, คูปองยังไม่หักจริง,
ตัวเลือกเมนูว่าง, ร้าน 14 แห่งไม่มีเจ้าของบัญชี
