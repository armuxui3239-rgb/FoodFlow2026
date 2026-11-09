import 'server-only';
import { sbList, sbInsert } from '@/lib/supabase';
import type { SessionUser } from '@/lib/session';
import { parseSession, SESSION_COOKIE } from '@/lib/session';
import { cookies } from 'next/headers';

/** อ่าน session จากคุกกี้ (ฝั่ง API route) */
export async function currentSession(): Promise<SessionUser | null> {
  const store = await cookies();
  return parseSession(store.get(SESSION_COOKIE)?.value);
}

/** ต้องมีบทบาทใดบทบาทหนึ่งเหล่านี้ — ไม่ใช่คืน null */
export async function requireRole(...roles: string[]): Promise<SessionUser | null> {
  const s = await currentSession();
  if (!s || !roles.includes(s.role)) return null;
  return s;
}

export interface OwnerProfile {
  userId: string;
  restaurantId: string;
  restaurantName: string;
  isOpen: boolean;
}

/** ร้านของเจ้าของที่ล็อกอิน (จาก restaurant_profiles ที่ is_active) */
export async function getOwnerRestaurant(userId: string): Promise<OwnerProfile | null> {
  const profiles = await sbList<{ id: string; restaurant_id: string; is_active: boolean }>(
    'restaurant_profiles',
    { user_id: `eq.${userId}`, is_active: 'eq.true', select: 'id,restaurant_id,is_active', limit: '1' },
  );
  const profile = profiles[0];
  if (!profile) return null;
  const rows = await sbList<{ id: string; name: string; is_open: boolean }>('restaurants', {
    id: `eq.${profile.restaurant_id}`,
    select: 'id,name,is_open',
    limit: '1',
  });
  const rst = rows[0];
  if (!rst) return null;
  return { userId, restaurantId: rst.id, restaurantName: rst.name, isOpen: rst.is_open };
}

/** บันทึกประวัติการเปลี่ยนสถานะออเดอร์ (order_status_history) */
export async function pushStatusHistory(orderId: string, status: string, changedBy: string, note?: string) {
  await sbInsert('order_status_history', {
    order_id: orderId,
    status,
    changed_by: changedBy,
    ...(note ? { note } : {}),
  });
}

/** สถานะถัดไปที่ร้านอนุญาต — กันกระโดดข้ามลำดับ */
export const OWNER_TRANSITIONS: Record<string, Record<string, string>> = {
  // จากสถานะปัจจุบัน → action ที่ทำได้ → สถานะใหม่
  paid: { accept: 'restaurant_accepted' },
  restaurant_accepted: { prepare: 'preparing' },
  preparing: { ready: 'ready_for_pickup' },
};

export const DRIVER_TRANSITIONS: Record<string, Record<string, string>> = {
  ready_for_pickup: { accept: 'driver_assigned' },
  driver_assigned: { pickup: 'picked_up' },
  picked_up: { deliver: 'delivered' },
};
