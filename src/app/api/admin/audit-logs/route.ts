import { NextRequest } from 'next/server';
import { requireRole } from '@/lib/portal';
import { sbList } from '@/lib/supabase';
import { jsonError } from '@/lib/api-user';

function csvCell(v: unknown): string {
  if (v === null || v === undefined) return '';
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}

/** GET /api/admin/audit-logs — บันทึกการทำงานของแอดมิน (กรอง action/from/to + แบ่งหน้า 20/หน้า หรือ ?format=csv) */
export async function GET(req: NextRequest) {
  const admin = await requireRole('admin');
  if (!admin) return jsonError('เฉพาะผู้ดูแลระบบเท่านั้น', 403);

  const sp = req.nextUrl.searchParams;
  const action = sp.get('action')?.trim() ?? '';
  const from = sp.get('from')?.trim() ?? '';
  const to = sp.get('to')?.trim() ?? '';
  const format = sp.get('format')?.trim() ?? '';

  const base: Record<string, string> = {
    select: 'id,admin_id,action,target_type,target_id,old_value,new_value,ip_address,severity,created_at',
    order: 'created_at.desc',
  };
  if (action) base.action = `ilike.*${action}*`;
  if (from) base['created_at'] = `gte.${from}`;
  if (to) {
    // to เป็นวันที่ (YYYY-MM-DD) → ให้ครอบคลุมถึงสิ้นวัน
    const toInclusive = /^\d{4}-\d{2}-\d{2}$/.test(to) ? `${to}T23:59:59+07:00` : to;
    base['created_at'] = base['created_at'] ? `${base['created_at']},lte.${toInclusive}` : `lte.${toInclusive}`;
  }

  if (format === 'csv') {
    const rows = await sbList<LogRow>('admin_audit_logs', { ...base, limit: '1000' });
    const adminIds = [...new Set(rows.map((r) => r.admin_id))];
    const users = adminIds.length
      ? await sbList<{ id: string; full_name: string }>('users', { id: `in.(${adminIds.join(',')})`, select: 'id,full_name', limit: '500' })
      : [];
    const csv =
      '\uFEFF' +
      [['เวลา', 'แอดมิน', 'การกระทำ', 'เป้าหมาย', 'รหัสเป้าหมาย', 'ระดับความรุนแรง', 'IP'], ...rows.map((r) => [
        r.created_at,
        users.find((u) => u.id === r.admin_id)?.full_name ?? '-',
        r.action,
        r.target_type,
        r.target_id ?? '',
        r.severity,
        r.ip_address,
      ])].map((r) => r.map(csvCell).join(',')).join('\r\n');
    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="foodflow-audit-logs.csv"',
      },
    });
  }

  const page = Math.max(0, Number(sp.get('page') ?? 1) - 1);
  const rows = await sbList<LogRow>('admin_audit_logs', { ...base, limit: '20', offset: String(page * 20) });

  const adminIds = [...new Set(rows.map((r) => r.admin_id))];
  const users = adminIds.length
    ? await sbList<{ id: string; full_name: string; email: string }>('users', { id: `in.(${adminIds.join(',')})`, select: 'id,full_name,email', limit: '100' })
    : [];

  return Response.json({
    data: rows.map((r) => ({
      ...r,
      adminName: users.find((u) => u.id === r.admin_id)?.full_name ?? '-',
      adminEmail: users.find((u) => u.id === r.admin_id)?.email ?? '-',
    })),
    page: page + 1,
  });
}

interface LogRow {
  id: number;
  admin_id: string;
  action: string;
  target_type: string;
  target_id: string | null;
  old_value: unknown;
  new_value: unknown;
  ip_address: string;
  severity: string;
  created_at: string;
}
