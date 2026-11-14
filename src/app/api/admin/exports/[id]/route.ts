import { NextRequest } from 'next/server';
import { requireRole } from '@/lib/portal';
import { sbList, sbOne } from '@/lib/supabase';
import { jsonError } from '@/lib/api-user';

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

const RESOURCES = ['orders', 'users', 'restaurants', 'reviews'];

function csvCell(v: unknown): string {
  if (v === null || v === undefined) return '';
  const s = typeof v === 'boolean' ? (v ? 'true' : 'false') : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}

/** สร้าง CSV ใหม่จากฐานข้อมูลจริง (ใช้เมื่อ file_url เก็บลิงก์แทน data URI) */
async function rebuildCsv(
  resource: string,
  filters: Record<string, string>,
): Promise<string> {
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
    return [headersOrders(), ...orders.map((o) => [
      o.order_code,
      o.status,
      restaurants.find((r) => r.id === o.restaurant_id)?.name ?? '-',
      customers.find((c) => c.id === o.customer_id)?.full_name ?? '-',
      (Number(o.total) / 100).toFixed(2),
      o.created_at,
    ])].map((r) => r.map(csvCell).join(',')).join('\r\n');
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
    return [['อีเมล', 'ชื่อ-นามสกุล', 'บทบาท', 'เบอร์โทร', 'เปิดใช้งาน', 'วันที่สมัคร', 'รหัสผู้ใช้'], ...users.map((u) => [
      u.email, u.full_name, u.role, u.phone ?? '', u.is_active, u.created_at, u.id,
    ])].map((r) => r.map(csvCell).join(',')).join('\r\n');
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
    return [['ชื่อร้าน', 'slug', 'เมือง', 'โทรศัพท์', 'สถานะอนุมัติ', 'เปิดอยู่', 'ใช้งาน', 'คะแนน', 'จำนวนรีวิว', 'รหัสร้าน'], ...restaurants.map((r) => [
      r.name, r.slug, r.city, r.phone ?? '', r.approval_status, r.is_open, r.is_active, Number(r.rating).toFixed(2), r.total_reviews, r.id,
    ])].map((r) => r.map(csvCell).join(',')).join('\r\n');
  }
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
  return [['รหัสรีวิว', 'รหัสออเดอร์', 'คะแนนอาหาร', 'คะแนนส่ง', 'ความคิดเห็น', 'การตอบกลับ', 'ถูกซ่อน', 'วันที่'], ...reviews.map((r) => [
    r.id, r.order_id, r.food_rating, r.delivery_rating ?? '', r.comment ?? '', r.reply ?? '', r.is_hidden, r.created_at,
  ])].map((r) => r.map(csvCell).join(',')).join('\r\n');
}

function headersOrders(): string[] {
  return ['รหัสออเดอร์', 'สถานะ', 'ร้าน', 'ลูกค้า', 'ยอดรวม (บาท)', 'วันที่สร้าง'];
}

/** GET /api/admin/exports/[id] — ดูงานส่งออก; ?download=1 → ส่งไฟล์ CSV เป็น attachment */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const admin = await requireRole('admin');
  if (!admin) return jsonError('เฉพาะผู้ดูแลระบบเท่านั้น', 403);
  const { id } = await ctx.params;

  const job = await sbOne<JobRow>('admin_export_jobs', {
    id: `eq.${id}`,
    select: 'id,requested_by_id,resource,format,status,filters,progress,file_url,error_message,expires_at,created_at,updated_at',
  });
  if (!job) return jsonError('ไม่พบงานส่งออกนี้', 404);

  const download = req.nextUrl.searchParams.get('download');
  if (!download) return Response.json({ job });

  if (job.status !== 'completed') {
    return jsonError('งานส่งออกนี้ยังไม่เสร็จสิ้น จึงดาวน์โหลดไม่ได้', 400);
  }
  const filters = job.filters ?? {};

  // file_url เก็บ data:text/csv;base64 → ถอดรหัสใช้เลย; ถ้าเก็บลิงก์ (fallback) → สร้าง CSV ใหม่จากฐานข้อมูล
  const fileUrl = job.file_url ?? '';
  if (fileUrl.startsWith('data:text/csv;base64,')) {
    const body = Buffer.from(fileUrl.slice('data:text/csv;base64,'.length), 'base64');
    return new Response(new Uint8Array(body), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="foodflow-${job.resource}-${job.id.slice(0, 8)}.csv"`,
      },
    });
  }
  let csv: string;
  try {
    if (!RESOURCES.includes(job.resource)) return jsonError('ทรัพยากรของงานนี้ไม่รองรับการสร้างใหม่', 400);
    csv = '\uFEFF' + (await rebuildCsv(job.resource, filters));
  } catch (e) {
    return jsonError('สร้างไฟล์ใหม่ไม่สำเร็จ: ' + (e as Error).message, 500);
  }
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="foodflow-${job.resource}-${job.id.slice(0, 8)}.csv"`,
    },
  });
}
