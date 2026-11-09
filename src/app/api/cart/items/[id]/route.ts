import { NextRequest } from 'next/server';
import { sbDelete, sbOne, sbUpdate } from '@/lib/supabase';
import { currentUser, jsonError } from '@/lib/api-user';
import { loadCart } from '@/lib/cart-server';

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return jsonError('กรุณาเข้าสู่ระบบ', 401);
  const { id } = await ctx.params;
  const { quantity } = (await req.json()) as { quantity?: number };
  if (typeof quantity !== 'number') return jsonError('จำนวนไม่ถูกต้อง', 400);
  const cartItem = await sbOne<{ id: string; cart_id: string }>('cart_items', {
    id: `eq.${id}`,
    select: 'id,cart_id',
  });
  if (!cartItem) return jsonError('ไม่พบรายการในตะกร้า', 404);
  if (quantity <= 0) {
    await sbDelete('cart_items', { id: `eq.${cartItem.id}` });
  } else {
    await sbUpdate('cart_items', { id: `eq.${cartItem.id}` }, { quantity });
  }
  return Response.json(await loadCart(user.id));
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return jsonError('กรุณาเข้าสู่ระบบ', 401);
  const { id } = await ctx.params;
  await sbDelete('cart_items', { id: `eq.${id}` });
  return Response.json(await loadCart(user.id));
}
