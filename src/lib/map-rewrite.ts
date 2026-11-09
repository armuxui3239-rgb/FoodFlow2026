import 'server-only';
import { MAP_ALLOWED_HOSTS } from '@/lib/map-config';

/**
 * เปลี่ยน URL ทรัพยากรใน style/TileJSON ให้ไหลผ่าน proxy ของเรา
 * - URL ธรรมดา (เช่น TileJSON) → <base>/api/map/proxy?u=<base64url>
 * - URL ที่มี token ของ maplibre ({z}/{x}/{y}, {fontstack}/{range}) →
 *   <base>/api/map/proxy?host=<host>&p=<path>
 *   (คง token ดิบให้ maplibre expand เอง — ห้ามใช้ URLSearchParams เพราะจะ encode {})
 * - base = origin ของคำขอ (absolute URL จำเป็น: maplibre v6 ปฏิเสธ relative sprite/glyphs)
 */
function encodeQueryValue(raw: string): string {
  return raw
    .replace(/%/g, '%25')
    .replace(/&/g, '%26')
    .replace(/=/g, '%3D')
    .replace(/\?/g, '%3F')
    .replace(/#/g, '%23')
    .replace(/\+/g, '%2B')
    .replace(/\s/g, '%20');
}

export function rewriteMapResourceUrls(node: unknown, base = ''): unknown {
  if (typeof node === 'string') {
    if (!/^https?:\/\//.test(node)) return node;
    let url: URL;
    try {
      url = new URL(node);
    } catch {
      return node;
    }
    if (!MAP_ALLOWED_HOSTS.includes(url.host)) return node;
    // ใช้ host/p form สำหรับทุกทรัพยากร — sprite ต้องรองรับการ append @2x.png
    // ท้าย URL โดย maplibre (การใช้ ?u=<base64> จะทำให้ append ไปโดน base64 เพี้ยน)
    let rawPathQuery = `${url.pathname}${url.search}`;
    try {
      rawPathQuery = decodeURIComponent(rawPathQuery);
    } catch {
      // คงเดิมถ้า decode ไม่ได้
    }
    return `${base}/api/map/proxy?host=${encodeURIComponent(url.host)}&p=${encodeQueryValue(rawPathQuery)}&mv=2`;
  }
  if (Array.isArray(node)) return node.map((v) => rewriteMapResourceUrls(v, base));
  if (node && typeof node === 'object') {
    return Object.fromEntries(Object.entries(node).map(([k, v]) => [k, rewriteMapResourceUrls(v, base)]));
  }
  return node;
}
