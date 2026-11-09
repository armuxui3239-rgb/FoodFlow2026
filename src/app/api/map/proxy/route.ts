import { NextRequest } from 'next/server';
import { createHash } from 'crypto';
import { mkdir, readFile, writeFile } from 'fs/promises';
import path from 'path';
import { MAP_ALLOWED_HOSTS, MAP_CACHE_DIR, MAP_USER_AGENT } from '@/lib/map-config';
import { rewriteMapResourceUrls } from '@/lib/map-rewrite';
import { fetchRaw } from '@/lib/fetch-raw';

export const dynamic = 'force-dynamic';

/**
 * GET /api/map/proxy — แคชแผ่นที่/ฟอนต์/TileJSON ในเครื่อง (v3.1 ข้อ 5)
 * รองรับ 2 รูปแบบ:
 *  - ?u=<base64url ของ URL เต็ม>          (URL ธรรมดา เช่น TileJSON)
 *  - ?host=<host>&p=<path มี {token}>     (maplibre expand แล้ว — เราส่งตรงด้วย https.request)
 * รับเฉพาะโฮสต์ใน MAP_ALLOWED_HOSTS (ป้องกัน SSRF) + User-Agent ของแอปเสมอ
 * คำตอบ JSON (TileJSON) จะถูก rewrite ให้ URL ภายในยังไหลผ่าน proxy ต่อ
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  let targetPath: string;
  let host: string;
  let isTileJson = false;

  const u = sp.get('u');
  const ph = sp.get('host');
  const p = sp.get('p');
  if (u) {
    let target: URL;
    try {
      target = new URL(Buffer.from(u, 'base64url').toString());
    } catch {
      return new Response('bad u', { status: 400 });
    }
    if (!MAP_ALLOWED_HOSTS.includes(target.host)) {
      return new Response('host not allowed', { status: 403 });
    }
    host = target.host;
    targetPath = `${target.pathname}${target.search}`;
    isTileJson = targetPath.endsWith('.json');
  } else if (ph && p) {
    if (!MAP_ALLOWED_HOSTS.includes(ph)) {
      return new Response('host not allowed', { status: 403 });
    }
    let raw = p;
    try {
      raw = decodeURIComponent(raw);
    } catch {
      // ใช้ตามที่ส่งมา
    }
    if (!raw.startsWith('/')) return new Response('bad p', { status: 400 });
    host = ph;
    targetPath = raw;
    isTileJson = raw.endsWith('.json');
  } else {
    return new Response('missing params', { status: 400 });
  }

  const full = `https://${host}${targetPath}`;
  const key = createHash('sha256').update(full).digest('hex');
  const cachePath = path.join(process.cwd(), MAP_CACHE_DIR, key);
  const respond = (buf: Buffer, json: boolean, type?: string) =>
    new Response(new Uint8Array(buf), {
      headers: {
        'Content-Type': json ? 'application/json' : type ?? 'application/octet-stream',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });

  try {
    const cached = await readFile(cachePath);
    return respond(cached, isTileJson);
  } catch {
    // ยังไม่มีในแคช
  }

  try {
    const base = new URL(req.url).origin;
    const upstream = await fetchRaw(full, { 'User-Agent': MAP_USER_AGENT });
    // ส่งสถานะต้นทางตรง — maplibre พึ่ง 404 ของ sprite@1x เพื่อไปใช้ @2x
    if (upstream.status === 404) {
      // sprite ที่ไม่มี @2x.png จะ 404 จากต้นทาง — ลองเติม @2x.png ให้เอง (maplibre ขอ base ได้ตาม pixelRatio)
      if (/\/sprites\//.test(targetPath) && !/\.png$/.test(targetPath)) {
        const fallback = await fetchRaw(`${full}@2x.png`, { 'User-Agent': MAP_USER_AGENT });
        if (fallback.status === 200) {
          const key2 = createHash('sha256').update(`${full}@2x.png`).digest('hex');
          const cachePath2 = path.join(process.cwd(), MAP_CACHE_DIR, key2);
          await mkdir(path.dirname(cachePath2), { recursive: true });
          await writeFile(cachePath2, fallback.body);
          return respond(fallback.body, false, fallback.contentType);
        }
      }
      return new Response(null, { status: 404 });
    }
    if (upstream.status >= 400) return new Response('upstream error', { status: 502 });
    let payload = upstream.body;
    if (upstream.contentType.includes('application/json')) {
      payload = Buffer.from(JSON.stringify(rewriteMapResourceUrls(JSON.parse(payload.toString()), base)));
      isTileJson = true;
    }
    await mkdir(path.dirname(cachePath), { recursive: true });
    await writeFile(cachePath, payload);
    return respond(payload, isTileJson, upstream.contentType);
  } catch (err) {
    console.error('map/proxy error:', err);
    return new Response('proxy error', { status: 502 });
  }
}
