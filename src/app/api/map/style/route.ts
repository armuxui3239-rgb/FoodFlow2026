import { NextRequest } from 'next/server';
import { MAP_STYLE_UPSTREAM, MAP_USER_AGENT } from '@/lib/map-config';
import { rewriteMapResourceUrls } from '@/lib/map-rewrite';

export const dynamic = 'force-dynamic';

/**
 * GET /api/map/style
 * คืน style JSON ของแผนที่ โดยเปลี่ยน URL ทรัพยากรทั้งหมด (tiles/glyphs/sprites)
 * ให้เป็น absolute URL ที่ไหลผ่าน /api/map/proxy เพื่อแคชแผ่นที่ในเครื่อง
 * และตั้ง User-Agent ของแอปแทนผู้ใช้ (แพตช์ v3.1 ข้อ 5)
 */
export async function GET(req: NextRequest) {
  try {
    const base = new URL(req.url).origin;
    const res = await fetch(MAP_STYLE_UPSTREAM, {
      headers: { 'User-Agent': MAP_USER_AGENT },
      cache: 'no-store',
    });
    if (!res.ok) {
      return Response.json({ error: 'โหลดแผนที่ไม่สำเร็จ' }, { status: 502 });
    }
    const style = rewriteMapResourceUrls(await res.json(), base);
    return Response.json(style, {
      // style เล็กและเปลี่ยนได้ตาม env — no-store เพื่อให้สลับ tile server เห็นผลทันที
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (err) {
    console.error('map/style error:', err);
    return Response.json({ error: 'โหลดแผนที่ไม่สำเร็จ' }, { status: 502 });
  }
}
