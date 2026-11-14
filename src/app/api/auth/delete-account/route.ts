import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { sbDelete, sbList, sbOne, sbUpdate } from '@/lib/supabase';
import { currentUser, jsonError } from '@/lib/api-user';

/** POST /api/auth/delete-account — ลบบัญชี (สิทธิ์ลบข้อมูลส่วนบุคคล ตาม PDPA / v4 ข้อ 11)
 *  ปิดบัญชี + ลบข้อมูลส่วนบุคคลทันที (ชื่อ/อีเมล/เบอร์/ที่อยู่/ร้านโปรด/PIN)
 *  คงบันทึกธุรกรรมแบบไม่ระบุตัวตนไว้ตามภาระกฎหมาย (ข้อ 5 ของนโยบาย PDPA) */
export async function POST() {
  try {
    const user = await currentUser();
    if (!user) return jsonError('กรุณาเข้าสู่ระบบ', 401);
    if (user.role !== 'customer') return jsonError('เฉพาะบัญชีลูกค้าเท่านั้น (บัญชีพนักงานติดต่อผู้ดูแล)', 403);

    const anonId = user.id.slice(0, 8);

    // ลบข้อมูลส่วนบุคคลที่ผูกกับบัญชี
    await sbDelete('addresses', { user_id: `eq.${user.id}` });
    await sbDelete('favorite_restaurants', { user_id: `eq.${user.id}` });
    await sbDelete('cart_items', { user_id: `eq.${user.id}` });
    const carts = await sbList<{ id: string }>('carts', { user_id: `eq.${user.id}`, select: 'id', limit: '10' });
    for (const cart of carts) await sbDelete('carts', { id: `eq.${cart.id}` });

    // ไม่ระบุตัวตนบัญชี (คง order/wallet history เพื่อภาระกฎหมาย — ไม่ผูกตัวตนได้อีก)
    await sbUpdate('users', { id: `eq.${user.id}` }, {
      email: `deleted-${anonId}@deleted.invalid`,
      phone: `del-${anonId}`,
      full_name: 'บัญชีที่ถูกลบ',
      password_hash: bcrypt.hashSync(crypto.randomUUID(), 12),
      is_active: false,
      phone_verified_at: null,
      failed_login_count: 0,
      locked_until: null,
      updated_at: new Date().toISOString(),
    });

    const profile = await sbOne<{ id: string; preferences: Record<string, unknown> | null }>('customer_profiles', {
      user_id: `eq.${user.id}`,
      select: 'id,preferences',
    });
    if (profile) {
      await sbUpdate('customer_profiles', { id: `eq.${profile.id}` }, {
        preferences: { deleted: true, deleted_at: new Date().toISOString() },
      });
    }

    return Response.json({ data: { ok: true } });
  } catch (err) {
    console.error('delete-account error:', err);
    return jsonError('ลบบัญชีไม่สำเร็จ กรุณาติดต่อฝ่ายบริการ', 500);
  }
}
