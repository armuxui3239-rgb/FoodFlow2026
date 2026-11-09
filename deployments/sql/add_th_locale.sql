-- เพิ่มค่า 'th' ใน enum LocaleCode ของ Supabase (รันใน SQL Editor ของแดชบอร์ด)
-- ทำครั้งเดียว จากนั้นตั้ง USER_LOCALE_DEFAULT=th ใน .env — ไม่ต้องแก้โค้ด
ALTER TYPE "LocaleCode" ADD VALUE IF NOT EXISTS 'th';

-- ทางเลือก: ย้ายผู้ใช้เดิมทั้งหมดไปเป็นภาษาไทย
UPDATE users SET preferred_locale = 'th' WHERE preferred_locale IS NOT NULL;
