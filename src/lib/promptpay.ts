import 'server-only';

/**
 * PromptPay EMVCo payload (mobile number or national ID) + CRC16-CCITT
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

export function promptPayPayload(target: string, amountSatang: number): string {
  const bahtAmount = amountSatang / 100; // สตางค์ → บาท (ฟิลด์ 54 ของ EMVCo ใช้หน่วยบาท ทศนิยม 2 ตำแหน่ง)
  const targetValue = target.replace(/\D/g, '');
  let merchant: string;
  if (targetValue.length === 13) {
    merchant = tlv('02', '01') + tlv('03', targetValue);
  } else {
    // phone number → 0066 + drop leading 0
    const phone = targetValue.startsWith('0') ? `0066${targetValue.slice(1)}` : `0066${targetValue}`;
    merchant = tlv('02', '29') + tlv('03', phone);
  }
  const payload =
    tlv('00', '01') +
    tlv('01', '12') + // dynamic
    tlv('29', tlv('00', 'A000000677010111') + merchant) +
    tlv('52', '5999') +
    tlv('53', '764') +
    tlv('54', bahtAmount.toFixed(2)) +
    tlv('58', 'TH') +
    tlv('62', tlv('01', 'FoodThunder')) +
    '6304';
  return payload + crc16(payload);
}
