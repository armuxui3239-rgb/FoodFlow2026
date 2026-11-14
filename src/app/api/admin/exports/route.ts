import { NextRequest } from 'next/server';
import { requireRole } from '@/lib/portal';
import { sbList, sbInsert, sbUpdate, sbHeaders } from '@/lib/supabase';
import { jsonError } from '@/lib/api-user';

const RESOURCES = ['orders', 'users', 'restaurants', 'reviews'] as const;
type ExportResource = (typeof RESOURCES)[number];

/** เขียนช่อง CSV ให้ปลอดภัย (ครอบด้วยเครื่องหมายคำพูดถ้ามี , " หรือขึ้นบรรทัดใหม่) */
function csvCell(v: unknown): string {
  if (v === null || v === undefined) return '';
  const s = typeof v === 'boolean' ? (v ? 'true' : 'false') : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}

function toCsv(headers: string[], rows: unknown[][]): string {
  return [headers, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n');
}

/** สร้างแถว CSV ตามทรัพยากร (ดึงจากฐานข้อมูลจริง สูงสุด 1,000 แถว) */
async function buildCsv(
  resource: ExportResource,
  filters: Record<string, string>,
): Promise<{ headers: string[]; rows: unknown[][] }> {
  if (resource === 'orders') {
    const orders = await sbList<{
      id: string;
      order_code: string;
      status: string;
      total: number;
      restaurant_id: string;
      customer_id: string;
      created_at: string;
    }>('orders', {
      select: 'id,order_code,status,total,restaurant_id,customer_id,created_at',
      order: 'created_at.desc',
      limit: '1000',
      ...(filters.status ? { status: `eq.${filters.status}` } : {}),
    });
    const rstIds = [...new Set(orders.map((o) => o.restaurant_id))];
    const cusIds = [...new Set(orders.map((o) => o.customer_id))];
    const [restaurants, customers] = await Promise.all([
      rstIds.length
        ? sbList<{ id: string; name: string }>('restaurants', { id: `in.(${rstIds.join(',')})`, select: 'id,name', limit: '500' })
        : Promise.resolve([] as { id: string; name: string }[]),
      cusIds.length
        ? sbList<{ id: string; full_name: string }>('users', { id: `in.(${cusIds.join(',')})`, select: 'id,full_name', limit: '500' })
        : Promise.resolve([] as { id: string; full_name: string }[]),
    ]);
    return {
      headers: ['รหัสออเดอร์', 'สถานะ', 'ร้าน', 'ลูกค้า', 'ยอดรวม (บาท)', 'วันที่สร้าง'],
      rows: orders.map((o) => [
        o.order_code,
        o.status,
        restaurants.find((r) => r.id === o.restaurant_id)?.name ?? '-',
        customers.find((c) => c.id === o.customer_id)?.full_name ?? '-',
        (Number(o.total) / 100).toFixed(2),
        o.created_at,
      ]),
    };
  }
  if (resource === 'users') {
    const users = await sbList<{
      id: string;
      email: string;
      phone: string | null;
      full_name: string;
      role: string;
      is_active: boolean;
      created_at: string;
    }>('users', {
      select: 'id,email,phone,full_name,role,is_active,created_at',
      order: 'created_at.desc',
      limit: '1000',
      ...(filters.role ? { role: `eq.${filters.role}` } : {}),
    });
    return {
      headers: ['อีเมล', 'ชื่อ-นามสกุล', 'บทบาท', 'เบอร์โทร', 'เปิดใช้งาน', 'วันที่สมัคร', 'รหัสผู้ใช้'],
      rows: users.map((u) => [u.email, u.full_name, u.role, u.phone ?? '', u.is_active, u.created_at, u.id]),
    };
  }
  if (resource === 'restaurants') {
    const restaurants = await sbList<{
      id: string;
      name: string;
      slug: string;
      city: string;
      phone: string | null;
      approval_status: string;
      is_open: boolean;
      is_active: boolean;
      rating: number;
      total_reviews: number;
    }>('restaurants', {
      select: 'id,name,slug,city,phone,approval_status,is_open,is_active,rating,total_reviews',
      order: 'name.asc',
      limit: '1000',
      ...(filters.approvalStatus ? { approval_status: `eq.${filters.approvalStatus}` } : {}),
    });
    return {
      headers: ['ชื่อร้าน', 'slug', 'เมือง', 'โทรศัพท์', 'สถานะอนุมัติ', 'เปิดอยู่', 'ใช้งาน', 'คะแนน', 'จำนวนรีวิว', 'รหัสร้าน'],
      rows: restaurants.map((r) => [
        r.name,
        r.slug,
        r.city,
        r.phone ?? '',
        r.approval_status,
        r.is_open,
        r.is_active,
        Number(r.rating).toFixed(2),
        r.total_reviews,
        r.id,
      ]),
    };
  }
  // reviews
  const reviews = await sbList<{
    id: string;
    order_id: string;
    food_rating: number;
    delivery_rating: number | null;
    comment: string | null;
    reply: string | null;
    is_hidden: boolean;
    created_at: string;
  }>('reviews', {
    select: 'id,order_id,food_rating,delivery_rating,comment,reply,is_hidden,created_at',
    order: 'created_at.desc',
    limit: '1000',
  });
  return {
    headers: ['รหัสรีวิว', 'รหัสออเดอร์', 'คะแนนอาหาร', 'คะแนนส่ง', 'ความคิดเห็น', 'การตอบกลับ', 'ถูกซ่อน', 'วันที่'],
    rows: reviews.map((r) => [
      r.id,
      r.order_id,
      r.food_rating,
      r.delivery_rating ?? '',
      r.comment ?? '',
      r.reply ?? '',
      r.is_hidden,
      r.created_at,
    ]),
  };
}

/** บันทึก admin_audit_logs (id BIGSERIAL — ใช้ fetch ตรงเพื่อไม่ให้ sbInsert เติม uuid) */
async function logAudit(adminId: string, action: string, req: NextRequest, newValue?: unknown): Promise<void> {
  const row: Record<string, unknown> = {
    admin_id: adminId,
    action,
    target_type: 'export_job',
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

interface JobRow {
  id: string;
  requested_by_id: string;
  resource: string;
  format: string;
  status: string;
  filters: Record<string, string> | null;
  progress: number;
  file_url: string | null;
  error_message: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

/** GET /api/admin/exports — งานส่งออกล่าสุด 20 รายการ */
export async function GET(_req: NextRequest) {
  const admin = await requireRole('admin');
  if (!admin) return jsonError('เฉพาะผู้ดูแลระบบเท่านั้น', 403);

  const jobs = await sbList<JobRow>('admin_export_jobs', {
    select: 'id,requested_by_id,resource,format,status,filters,progress,file_url,error_message,expires_at,created_at,updated_at',
    order: 'created_at.desc',
    limit: '20',
  });

  const userIds = [...new Set(jobs.map((j) => j.requested_by_id))];
  const users = userIds.length
    ? await sbList<{ id: string; full_name: string }>('users', {
        id: `in.(${userIds.join(',')})`,
        select: 'id,full_name',
        limit: '50',
      })
    : [];

  return Response.json({
    data: jobs.map((j) => ({
      ...j,
      requestedByName: users.find((u) => u.id === j.requested_by_id)?.full_name ?? '-',
    })),
  });
}

/**
 * POST /api/admin/exports — สร้างงานส่งออก CSV แล้วสร้างไฟล์ให้เสร็จทันที (synchronous)
 * { resource: 'orders'|'users'|'restaurants'|'reviews', format?: 'csv', filters?: { status?, role?, approvalStatus? } }
 * เก็บไฟล์เป็น data:text/csv;base64 ใน file_url — ถ้าคอลัมน์สั้นเกินจะสำรองด้วยลิงก์ดาวน์โหลดแทน
 */
export async function POST(req: NextRequest) {
  const admin = await requireRole('admin');
  if (!admin) return jsonError('เฉพาะผู้ดูแลระบบเท่านั้น', 403);
  const { resource, format, filters } = (await req.json().catch(() => ({}))) as {
    resource?: string;
    format?: string;
    filters?: Record<string, string>;
  };
  if (!resource || !RESOURCES.includes(resource as ExportResource)) {
    return jsonError('resource ต้องเป็น orders, users, restaurants หรือ reviews', 400);
  }
  if (format && format !== 'csv') return jsonError('ขณะนี้ระบบรองรับเฉพาะรูปแบบ csv', 400);
  const safeFilters: Record<string, string> = {};
  for (const k of ['status', 'role', 'approvalStatus']) {
    if (filters?.[k]) safeFilters[k] = String(filters[k]).slice(0, 100);
  }

  const [job] = await sbInsert<JobRow>('admin_export_jobs', {
    requested_by_id: admin.id,
    resource,
    format: 'csv',
    status: 'queued',
    filters: safeFilters,
    progress: 0,
    expires_at: new Date(Date.now() + 7 * 86400_000).toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  try {
    const { headers, rows } = await buildCsv(resource as ExportResource, safeFilters);
    const csv = '\uFEFF' + toCsv(headers, rows);
    const dataUri = `data:text/csv;charset=utf-8;base64,${Buffer.from(csv).toString('base64')}`;
    try {
      await sbUpdate<JobRow>('admin_export_jobs', { id: `eq.${job.id}` }, {
        status: 'completed',
        progress: 100,
        file_url: dataUri,
        updated_at: new Date().toISOString(),
      });
    } catch {
      // file_url เป็น varchar(255) ในบางฐานข้อมูล — ใส่ data URI ไม่ได้ ใช้ลิงก์ดาวน์โหลดแทน
      await sbUpdate<JobRow>('admin_export_jobs', { id: `eq.${job.id}` }, {
        status: 'completed',
        progress: 100,
        file_url: `/api/admin/exports/${job.id}?download=1`,
        updated_at: new Date().toISOString(),
      });
    }
    await logAudit(admin.id, 'export.request', req, { resource, filters: safeFilters });
    return Response.json({ ok: true, jobId: job.id }, { status: 201 });
  } catch (e) {
    await sbUpdate<JobRow>('admin_export_jobs', { id: `eq.${job.id}` }, {
      status: 'failed',
      error_message: (e as Error).message.slice(0, 500),
      progress: 0,
      updated_at: new Date().toISOString(),
    });
    return jsonError('สร้างไฟล์ส่งออกไม่สำเร็จ: ' + (e as Error).message, 500);
  }
}
