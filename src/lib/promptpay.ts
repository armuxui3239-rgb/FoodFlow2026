import 'server-only';

/**
 * PromptPay EMVCo payload + CRC16-CCITT — รองรับครบ 3 รูปแบบตามมาตรฐาน Thai PromptPay:
 *  1) เบอร์มือถือ 10 หลัก                  → AID 010111 + 02=29 + 03=0066+เบอร์
 *  2) เลขประจำตัวประชาชน/ภาษี 13 หลัก     → AID 010111 + 02=01 + 03=เลข
 *  3) เลขบัญชีธนาคาร (ต้องมี bankCode 3 หลัก) → AID 010104 + 02=รหัสธนาคาร + 03=เลขบัญชี
 * เลขบัญชีเปล่า ๆ ที่ไม่มีรหัสธนาคาร = QR ที่สแกนไม่ผ่าน → throw กันสร้าง QR ปลอมเสมอ
 * @param amount จำนวนเงินหน่วยสตางค์ตามมาตรฐานฐานข้อมูล (เช่น 35000 = ฿350.00)
 */
function crc16(input: string): string {
  let crc = 0xffff;
  for (let i = 0; i < input.length; i++) {
    crc ^= input.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

function tlv(id: string, value: string): string {
  return id + String(value.length).padStart(2, '0') + value;
}

export function promptPayPayload(target: string, amountSatang: number, bankCode?: string): string {
  const bahtAmount = amountSatang / 100; // สตางค์ → บาท (ฟิลด์ 54 ของ EMVCo ใช้หน่วยบาท ทศนิยม 2 ตำแหน่ง)
  const targetValue = target.replace(/\D/g, '');
  const code = (bankCode ?? '').trim();
  let aid: string;
  let merchant: string;
  if (code) {
    if (!/^\d{3}$/.test(code)) throw new Error('รหัสธนาคารต้องเป็นตัวเลข 3 หลัก (PROMPTPAY_BANK_CODE)');
    if (targetValue.length < 8 || targetValue.length > 16) throw new Error('เลขบัญชีต้องเป็นตัวเลข 8–16 หลัก');
    aid = 'A000000677010104'; // PromptPay โอนเข้าบัญชีธนาคาร
    merchant = tlv('02', code) + tlv('03', targetValue);
  } else if (targetValue.length === 13) {
    aid = 'A000000677010111'; // PromptPay โดยเลขประจำตัว
    merchant = tlv('02', '01') + tlv('03', targetValue);
  } else if (targetValue.length === 9 || targetValue.length === 10) {
    // phone number → 0066 + drop leading 0
    const phone = targetValue.startsWith('0') ? `0066${targetValue.slice(1)}` : `0066${targetValue}`;
    aid = 'A000000677010111'; // PromptPay โดยเบอร์โทร
    merchant = tlv('02', '29') + tlv('03', phone);
  } else {
    throw new Error('เลขพร้อมเพย์ต้องเป็นเบอร์ 10 หลัก / เลขประจำตัว 13 หลัก / หรือเลขบัญชีพร้อมรหัสธนาคาร 3 หลัก');
  }
  const payload =
    tlv('00', '01') +
    tlv('01', '12') + // dynamic
    tlv('29', tlv('00', aid) + merchant) +
    tlv('52', '5999') +
    tlv('53', '764') +
    tlv('54', bahtAmount.toFixed(2)) +
    tlv('58', 'TH') +
    tlv('62', tlv('01', 'FoodThunder')) +
    '6304';
  return payload + crc16(payload);
}
