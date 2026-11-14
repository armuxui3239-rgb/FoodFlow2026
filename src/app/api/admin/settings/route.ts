import { NextRequest } from 'next/server';
import { requireRole } from '@/lib/portal';
import { sbList, sbOne, sbInsert, sbUpdate, sbHeaders } from '@/lib/supabase';
import { jsonError } from '@/lib/api-user';

/** บันทึก admin_audit_logs (id BIGSERIAL — ใช้ fetch ตรงเพื่อไม่ให้ sbInsert เติม uuid) */
async function logAudit(
  adminId: string,
  action: string,
  req: NextRequest,
  newValue?: unknown,
): Promise<void> {
  const row: Record<string, unknown> = {
    admin_id: adminId,
    action,
    target_type: 'platform_setting',
    ip_address: (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || '0.0.0.0',
    severity: 'info',
    created_at: new Date().toISOString(),
  };
  if (newValue !== undefined) row.new_value = newValue;
  try {
    await fetch(`${process.env.SUPABASE_URL}/rest/v1/admin_audit_logs`, {
      method: 'POST',
      headers: { ...sbHeaders(), Prefer: 'return=minimal' },
      body: JSON.stringify([row]),
    });
  } catch {
    // บันทึกตรวจสอบล้มเหลวต้องไม่ทำให้การทำงานหลักล้ม
  }
}

interface SettingRow {
  id: string;
  key: string;
  value: unknown;
  updated_by_id: string | null;
  updated_at: string;
}

/** GET /api/admin/settings — ค่าตั้งค่าแพลตฟอร์มทั้งหมด (พร้อมชื่อผู้แก้ล่าสุด) */
export async function GET(_req: NextRequest) {
  const admin = await requireRole('admin');
  if (!admin) return jsonError('เฉพาะผู้ดูแลระบบเท่านั้น', 403);

  const settings = await sbList<SettingRow>('platform_settings', {
    select: 'id,key,value,updated_by_id,updated_at',
    order: 'key.asc',
    limit: '200',
  });

  const userIds = [...new Set(settings.map((s) => s.updated_by_id).filter((x): x is string => Boolean(x)))];
  const users = userIds.length
    ? await sbList<{ id: string; full_name: string }>('users', {
        id: `in.(${userIds.join(',')})`,
        select: 'id,full_name',
        limit: '100',
      })
    : [];

  return Response.json({
    data: settings.map((s) => ({
      ...s,
      updatedByName: s.updated_by_id ? users.find((u) => u.id === s.updated_by_id)?.full_name ?? '-' : null,
    })),
  });
}

/**
 * PATCH /api/admin/settings — upsert ค่าตั้งค่า { key, value }
 * มี key อยู่แล้ว → update; ยังไม่มี → insert (id สุ่ม, updated_at = ตอนนี้)
 */
export async function PATCH(req: NextRequest) {
  const admin = await requireRole('admin');
  if (!admin) return jsonError('เฉพาะผู้ดูแลระบบเท่านั้น', 403);
  const { key, value } = (await req.json().catch(() => ({}))) as { key?: string; value?: unknown };
  if (!key?.trim()) return jsonError('กรุณาระบุ key', 400);
  if (value === undefined) return jsonError('กรุณาระบุ value', 400);
  const safeKey = key.trim().slice(0, 100);

  const existing = await sbOne<SettingRow>('platform_settings', { key: `eq.${safeKey}`, select: 'id,key,value,updated_by_id,updated_at' });
  const newValue = value as never;
  if (existing) {
    const [updated] = await sbUpdate<SettingRow>('platform_settings', { key: `eq.${safeKey}` }, {
      value: newValue,
      updated_by_id: admin.id,
      updated_at: new Date().toISOString(),
    });
    await logAudit(admin.id, 'settings.update', req, { key: safeKey, value });
    return Response.json({ ok: true, setting: updated });
  }
  const [created] = await sbInsert<SettingRow>('platform_settings', {
    key: safeKey,
    value: newValue,
    updated_by_id: admin.id,
    updated_at: new Date().toISOString(),
  });
  await logAudit(admin.id, 'settings.create', req, { key: safeKey, value });
  return Response.json({ ok: true, setting: created }, { status: 201 });
}
