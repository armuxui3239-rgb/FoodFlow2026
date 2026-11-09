import { NextRequest } from 'next/server';
import { sbList } from '@/lib/supabase';

export interface RestaurantRow {
  id: string;
  name: string;
  description: string | null;
  logo_url: string | null;
  cover_url: string | null;
  address_line: string | null;
  cuisine_types: string[] | null;
  price_range: string | null;
  rating: number | null;
  total_reviews: number | null;
  is_open: boolean;
  prep_time_avg_minutes: number | null;
  min_order_amount: number | null;
}

const SELECT =
  'id,name,description,logo_url,cover_url,address_line,cuisine_types,price_range,rating,total_reviews,is_open,prep_time_avg_minutes,min_order_amount';

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim();
  const rows = await sbList<RestaurantRow>('restaurants', {
    is_active: 'eq.true',
    approval_status: 'eq.approved',
    select: SELECT,
    order: 'rating.desc.nullslast',
    limit: '50',
  });
  const filtered = q
    ? rows.filter(
        (r) =>
          r.name.toLowerCase().includes(q.toLowerCase()) ||
          (r.cuisine_types ?? []).some((c) => c.toLowerCase().includes(q.toLowerCase())),
      )
    : rows;
  return Response.json({ data: filtered });
}
