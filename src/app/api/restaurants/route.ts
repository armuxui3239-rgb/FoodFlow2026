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

const SORTS: Record<string, string> = {
  rating: 'rating.desc.nullslast',
  reviews: 'total_reviews.desc.nullslast',
  time: 'prep_time_avg_minutes.asc.nullslast',
  name: 'name.asc',
};

/** GET /api/restaurants — รายการร้าน + ตัวกรอง: q, cuisine, price, rating, open, sort */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const q = sp.get('q')?.trim();
  const cuisine = sp.get('cuisine')?.trim();
  const price = sp.get('price')?.trim(); // เช่น "฿,฿฿"
  const minRating = sp.get('rating')?.trim(); // เช่น "4"
  const open = sp.get('open') === '1';
  const sort = sp.get('sort')?.trim() ?? 'rating';

  const params: Record<string, string> = {
    is_active: 'eq.true',
    approval_status: 'eq.approved',
    select: SELECT,
    order: SORTS[sort] ?? SORTS.rating,
    limit: '50',
  };
  if (open) params.is_open = 'eq.true';
  if (minRating && /^\d(\.\d)?$/.test(minRating)) params.rating = `gte.${minRating}`;
  if (price) {
    const list = price.split(',').map((p) => p.trim()).filter(Boolean).slice(0, 4);
    if (list.length > 0) params.price_range = `in.(${list.join(',')})`;
  }
  if (cuisine) {
    const list = cuisine.split(',').map((c) => c.trim()).filter(Boolean).slice(0, 6);
    if (list.length === 1) params.cuisine_types = `cs.{${list[0]}}`;
    else if (list.length > 1) params.cuisine_types = `ov.{${list.join(',')}}`; // หลายหมวด = มีหมวดใดหมวดหนึ่ง
  }

  const rows = await sbList<RestaurantRow>('restaurants', params);
  const filtered = q
    ? rows.filter(
        (r) =>
          r.name.toLowerCase().includes(q.toLowerCase()) ||
          (r.cuisine_types ?? []).some((c) => c.toLowerCase().includes(q.toLowerCase())),
      )
    : rows;
  return Response.json({ data: filtered });
}
