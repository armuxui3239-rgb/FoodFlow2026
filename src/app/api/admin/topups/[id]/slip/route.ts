import { NextRequest } from 'next/server';
import { requireRole } from '@/lib/portal';
import { sbOne, sbHeaders } from '@/lib/supabase';
import { jsonError } from '@/lib/api-user';

/** GET /api/admin/topups/[id]/slip — ส่งภาพสลิปให้แอดมินดู (อ่านจาก Storage ผ่าน service key เท่านั้น) */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const admin = await requireRole('admin');
  if (!admin) return jsonError('เฉพาะผู้ดูแลระบบเท่านั้น', 403);

  const { id } = await ctx.params;
  const tx = await sbOne<{ id: string; proof_url: string | null }>('wallet_transactions', {
    id: `eq.${id}`,
    select: 'id,proof_url',
  });
  if (!tx?.proof_url) return jsonError('ไม่พบสลิปของรายการนี้', 404);

  const res = await fetch(
    `${process.env.SUPABASE_URL}/storage/v1/object/topup-slips/${tx.proof_url}`,
    { headers: sbHeaders() },
  );
  if (!res.ok) return jsonError('ไม่พบไฟล์สลิป', 404);

  return new Response(res.body, {
    headers: {
      'Content-Type': res.headers.get('content-type') ?? 'image/png',
      'Cache-Control': 'private, max-age=60',
    },
  });
}
