import { currentUser } from '@/lib/api-user';

export async function GET() {
  const user = await currentUser();
  return Response.json({ user });
}
