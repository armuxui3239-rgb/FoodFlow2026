import { NextRequest } from 'next/server';
import { requireRole, getOwnerRestaurant } from '@/lib/portal';
import { sbOne, sbUpdate } from '@/lib/supabase';
import { jsonError } from '@/lib/api-user';

interface BankInfo {
  bank_name: string | null;
  bank_account_number: string | null;
  bank_account_name: string | null;
}

/** GET /api/owner/bank — บัญชีธนาคารรับรายได้ของร้าน (เจ้าของจัดการเอง) */
export async function GET(_req: NextRequest) {
  const user = await requireRole('restaurant');
  if (!user) return jsonError('เฉพาะเจ้าของร้านเท่านั้น', 403);
  const owner = await getOwnerRestaurant(user.id);
  if (!owner) return jsonError('บัญชีนี้ยังไม่ผูกกับร้านอาหาร', 404);

  const rst = await sbOne<BankInfo>('restaurants', {
    id: `eq.${owner.restaurantId}`,
    select: 'bank_name,bank_account_number,bank_account_name',
  });
  if (!rst) return jsonError('ไม่พบร้านของคุณ', 404);
  return Response.json({ data: rst });
}

/** PATCH /api/owner/bank — แก้บัญชีธนาคารของร้านตัวเอง { bankName, accountNumber, holderName } */
export async function PATCH(req: NextRequest) {
  const user = await requireRole('restaurant');
  if (!user) return jsonError('เฉพาะเจ้าของร้านเท่านั้น', 403);
  const owner = await getOwnerRestaurant(user.id);
  if (!owner) return jsonError('บัญชีนี้ยังไม่ผูกกับร้านอาหาร', 404);

  const { bankName, accountNumber, holderName } = (await req.json().catch(() => ({}))) as {
    bankName?: string;
    accountNumber?: string;
    holderName?: string;
  };
  const name = (bankName ?? '').trim();
  const number = (accountNumber ?? '').replace(/[\s-]/g, '');
  const holder = (holderName ?? '').trim();
  if (!name) return jsonError('กรุณาระบุชื่อธนาคาร', 400);
  if (!/^\d{8,16}$/.test(number)) return jsonError('เลขบัญชีต้องเป็นตัวเลข 8–16 หลัก', 400);
  if (holder.length < 3) return jsonError('กรุณาระบุชื่อเจ้าของบัญชี', 400);

  const [row] = await sbUpdate<BankInfo>(
    'restaurants',
    { id: `eq.${owner.restaurantId}` },
    {
      bank_name: name,
      bank_account_number: number,
      bank_account_name: holder,
      updated_at: new Date().toISOString(),
    },
  );
  if (!row) return jsonError('ไม่พบร้านของคุณ', 404);
  return Response.json({ data: row });
}
