import 'server-only';
import { sbList } from '@/lib/supabase';

const PAGE_SIZE = 1000;

/** รวมค่าคอลัมน์ตัวเลขจากทุกแถวที่ตรงเงื่อนไข (แบ่งหน้า 1000 แถว ไม่ตัดยอดที่ 50 รายการ) */
async function sumColumnPaged<T extends Record<string, unknown>>(
  table: string,
  baseParams: Record<string, string>,
  column: keyof T,
): Promise<number> {
  let total = 0;
  let offset = 0;
  while (true) {
    const rows = await sbList<T>(table, {
      ...baseParams,
      select: String(column),
      limit: String(PAGE_SIZE),
      offset: String(offset),
    });
    for (const row of rows) {
      total += Number(row[column] ?? 0);
    }
    if (rows.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }
  return total;
}

/** ยอดเงินคงเหลือในกระเป๋าเงิน (สตางค์) — นับเฉพาะรายการที่ status = completed ทั้งหมด */
export function getWalletBalance(userId: string): Promise<number> {
  return sumColumnPaged<{ amount_delta: number }>(
    'wallet_transactions',
    { user_id: `eq.${userId}`, status: 'eq.completed' },
    'amount_delta',
  );
}

/** แต้มสะสมรวมทั้งหมดของผู้ใช้ */
export function getLoyaltyPointsTotal(userId: string): Promise<number> {
  return sumColumnPaged<{ points: number }>(
    'loyalty_transactions',
    { user_id: `eq.${userId}` },
    'points',
  );
}
