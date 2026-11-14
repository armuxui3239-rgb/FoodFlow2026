import crypto from 'crypto';
import { NextRequest } from 'next/server';
import { requireRole, getOwnerRestaurant } from '@/lib/portal';
import { sbList, sbInsert, sbOne } from '@/lib/supabase';
import { jsonError } from '@/lib/api-user';

interface InviteRow {
  id: string;
  email: string;
  role: string;
  status: string;
  expires_at: string;
  created_at: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** GET /api/owner/staff/invites — คำเชิญที่ยังรอตอบรับของร้านฉัน (สถานะ pending และยังไม่หมดอายุ) */
export async function GET(_req: NextRequest) {
  const user = await requireRole('restaurant');
  if (!user) return jsonError('เฉพาะเจ้าของร้านเท่านั้น', 403);
  const owner = await getOwnerRestaurant(user.id);
  if (!owner) return jsonError('บัญชีนี้ยังไม่ผูกกับร้านอาหาร', 404);

  const invites = await sbList<InviteRow>('staff_invites', {
    restaurant_id: `eq.${owner.restaurantId}`,
    status: 'eq.pending',
    expires_at: `gt.${new Date().toISOString()}`,
    select: 'id,email,role,status,expires_at,created_at',
    order: 'created_at.desc',
    limit: '50',
  });
  return Response.json({ data: invites });
}

/** บทบาทที่เชิญได้ — enum StaffRole จริงในฐานข้อมูลรองรับครบทั้ง 5 ค่า */
const INVITE_ROLES = ['owner', 'manager', 'kitchen', 'cashier', 'viewer'] as const;

/**
 * POST /api/owner/staff/invites — สร้างคำเชิญพนักงาน { email, role? }
 * ระบบไม่มีการส่งอีเมล — สร้างลิงก์เชิญให้เจ้าของคัดลอกส่งให้พนักงานเอง
 */
export async function POST(req: NextRequest) {
  const user = await requireRole('restaurant');
  if (!user) return jsonError('เฉพาะเจ้าของร้านเท่านั้น', 403);
  const owner = await getOwnerRestaurant(user.id);
  if (!owner) return jsonError('บัญชีนี้ยังไม่ผูกกับร้านอาหาร', 404);

  const { email, role } = (await req.json().catch(() => ({}))) as { email?: string; role?: string };
  const mail = email?.trim().toLowerCase();
  if (!mail || !EMAIL_RE.test(mail)) return jsonError('กรุณาระบุอีเมลให้ถูกต้อง', 400);
  const inviteRole = role && INVITE_ROLES.includes(role as (typeof INVITE_ROLES)[number])
    ? role
    : 'manager';
  if (inviteRole === 'owner') return jsonError('ไม่สามารถเชิญบทบาทเจ้าของร้านซ้ำได้ — ร้านมีเจ้าของแล้ว', 400);

  // กันเชิญซ้ำ: มีคำเชิญที่ยังรอตอบรับของอีเมลนี้อยู่แล้ว
  const dup = await sbOne<{ id: string }>('staff_invites', {
    restaurant_id: `eq.${owner.restaurantId}`,
    email: `eq.${mail}`,
    status: 'eq.pending',
    expires_at: `gt.${new Date().toISOString()}`,
    select: 'id',
  });
  if (dup) return jsonError('มีคำเชิญสำหรับอีเมลนี้อยู่แล้ว (ยังไม่หมดอายุ)', 409);

  // โทเคนสุ่ม 32 ตัวอักษร hex — เก็บเฉพาะ sha256 hash ในฐานข้อมูล ส่งโทเคนดิบออกทางลิงก์ครั้งเดียว
  const token = crypto.randomBytes(16).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 7 * 86400_000).toISOString();

  // staff_invites บังคับ permissions (jsonb) และ created_at — เติมให้ครบ
  const [created] = await sbInsert<{ id: string; email: string; role: string; expires_at: string }>('staff_invites', {
    restaurant_id: owner.restaurantId,
    email: mail,
    role: inviteRole,
    permissions: [],
    token_hash: tokenHash,
    status: 'pending',
    invited_by_id: user.id,
    expires_at: expiresAt,
    created_at: now.toISOString(),
  });

  return Response.json(
    {
      ok: true,
      invite: created,
      inviteUrl: `/staff/accept?token=${token}`,
      note: 'ระบบยังไม่ส่งอีเมล กรุณาคัดลอกลิงก์ส่งให้พนักงานด้วยตัวเอง',
    },
    { status: 201 },
  );
}
