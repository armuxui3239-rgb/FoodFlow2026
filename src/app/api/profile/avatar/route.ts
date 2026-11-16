import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { sbHeaders, sbUpdate } from '@/lib/supabase';
import { currentUser, jsonError } from '@/lib/api-user';
import { PENDING_COOKIE, parsePending } from '@/lib/auth-flow';

const MAX_BYTES = 2 * 1024 * 1024; // 2MB
const OK_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);
const BUCKET = 'avatars';

/** สร้าง bucket avatars (public) อัตโนมัติถ้ายังไม่มี */
async function ensureAvatarsBucket(baseUrl: string) {
  const check = await fetch(`${baseUrl}/storage/v1/bucket/${BUCKET}`, {
    headers: sbHeaders(),
  });
  if (check.ok) return;
  await fetch(`${baseUrl}/storage/v1/bucket`, {
    method: 'POST',
    headers: { ...sbHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: BUCKET,
      name: BUCKET,
      public: true,
      file_size_limit: MAX_BYTES,
      allowed_mime_types: ['image/png', 'image/jpeg', 'image/webp'],
    }),
  });
}

/** POST /api/profile/avatar — อัปโหลดรูปโปรไฟล์ (รองรับทั้งผู้ที่ล็อกอินแล้วและระหว่าง onboarding) */
export async function POST(req: NextRequest) {
  try {
    const user = await currentUser();
    let targetUserId = user?.id ?? null;

    if (!targetUserId) {
      const cookieStore = await cookies();
      const flow = parsePending(cookieStore.get(PENDING_COOKIE)?.value);
      if (flow && flow.purpose === 'register') {
        targetUserId = flow.userId;
      }
    }
    if (!targetUserId) return jsonError('กรุณาเข้าสู่ระบบ', 401);

    const form = await req.formData().catch(() => null);
    if (!form) return jsonError('รูปแบบคำขอไม่ถูกต้อง', 400);

    const file = form.get('avatar');
    if (!file || typeof file === 'string') return jsonError('กรุณาเลือกไฟล์รูปภาพ', 400);
    if (!OK_TYPES.has(file.type)) return jsonError('รองรับเฉพาะไฟล์ PNG, JPG หรือ WEBP', 400);
    if (file.size > MAX_BYTES) return jsonError('ไฟล์รูปภาพต้องไม่เกิน 2MB', 400);

    const baseUrl = process.env.SUPABASE_URL;
    if (!baseUrl) return jsonError('ยังไม่ได้ตั้งค่า Storage', 500);

    await ensureAvatarsBucket(baseUrl);

    const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
    const objectPath = `${targetUserId}/avatar-${Date.now()}.${ext}`;
    const bytes = Buffer.from(await file.arrayBuffer());

    const upRes = await fetch(`${baseUrl}/storage/v1/object/${BUCKET}/${objectPath}`, {
      method: 'POST',
      headers: { ...sbHeaders(), 'Content-Type': file.type, 'x-upsert': 'true' },
      body: new Uint8Array(bytes),
    });
    if (!upRes.ok) {
      console.error('avatar upload failed:', upRes.status, await upRes.text().catch(() => ''));
      return jsonError('อัปโหลดรูปโปรไฟล์ไม่สำเร็จ กรุณาลองใหม่', 500);
    }

    const avatarUrl = `${baseUrl}/storage/v1/object/public/${BUCKET}/${objectPath}`;
    await sbUpdate('users', { id: `eq.${targetUserId}` }, {
      avatar_url: avatarUrl,
      updated_at: new Date().toISOString(),
    });

    return Response.json({ data: { avatarUrl } });
  } catch (err) {
    console.error('avatar upload error:', err);
    return jsonError('อัปโหลดรูปโปรไฟล์ไม่สำเร็จ กรุณาลองใหม่', 500);
  }
}
