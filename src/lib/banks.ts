/** รายการธนาคารไทยที่ระบบรองรับ — โลโก้จริงไฟล์ SVG เท่านั้น
 *  ที่มาโลโก้: omise/banks-logo (MIT License) — ไฟล์อยู่ที่ public/banks/ */
export interface ThaiBank {
  code: string;
  name: string;
  logo: string;
}

export const THAI_BANKS: ThaiBank[] = [
  { code: 'SCB', name: 'ไทยพาณิชย์', logo: '/banks/scb.svg' },
  { code: 'KBANK', name: 'กสิกรไทย', logo: '/banks/kbank.svg' },
  { code: 'KTB', name: 'กรุงไทย', logo: '/banks/ktb.svg' },
  { code: 'BBL', name: 'กรุงเทพ', logo: '/banks/bbl.svg' },
  { code: 'TTB', name: 'ทหารไทยธนชาต', logo: '/banks/ttb.svg' },
  { code: 'BAY', name: 'กรุงศรีอยุธยา', logo: '/banks/bay.svg' },
  { code: 'GSB', name: 'ออมสิน', logo: '/banks/gsb.svg' },
  { code: 'BAAC', name: 'เพื่อการเกษตร', logo: '/banks/baac.svg' },
  { code: 'GHB', name: 'อาคารสงเคราะห์', logo: '/banks/ghb.svg' },
  { code: 'UOB', name: 'UOB', logo: '/banks/uob.svg' },
  { code: 'CIMB', name: 'CIMB', logo: '/banks/cimb.svg' },
  { code: 'KKP', name: 'เกียรตินายน', logo: '/banks/kk.svg' },
  { code: 'TISCO', name: 'ทิสโก้', logo: '/banks/tisco.svg' },
  { code: 'TCRB', name: 'ศรีสวัสดิ์', logo: '/banks/tcrb.svg' },
  { code: 'IBANK', name: 'อิสลาม', logo: '/banks/ibank.svg' },
  { code: 'SC', name: 'สแตนดาร์ดชาร์เตด', logo: '/banks/sc.svg' },
];

/** หาโลโก้ธนาคารจากชื่อที่เก็บไว้ — รองรับชื่อเก่าที่มีรหัสในวงเล็บ เช่น 'ไทยพาณิชย์ (SCB)' */
export function bankLogoFor(name: string | null | undefined): string | null {
  if (!name) return null;
  const upper = name.toUpperCase();
  const byCode = THAI_BANKS.find((b) => upper.includes(b.code));
  if (byCode) return byCode.logo;
  const byName = THAI_BANKS.find((b) => name.includes(b.name));
  return byName?.logo ?? null;
}
