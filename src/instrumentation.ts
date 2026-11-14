/** ตรวจค่า env วิกฤตก่อนเซิร์ฟเวอร์เริ่มทำงาน — v4 ข้อ 4.4/เกณฑ์ 12.11:
 *  production ห้ามใช้ VERIFICATION_DELIVERY=dev_console เด็ดขาด (backend ปฏิเสธเริ่ม) */
export async function register() {
  if (process.env.NODE_ENV === 'production' && process.env.VERIFICATION_DELIVERY === 'dev_console') {
    throw new Error(
      'ห้ามใช้ VERIFICATION_DELIVERY=dev_console ใน production — ระบบปฏิเสธเริ่มทำงาน (ตั้งเป็น internal_code)',
    );
  }
}
