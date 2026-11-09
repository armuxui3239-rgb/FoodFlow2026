import 'server-only';
import https from 'https';

/**
 * ดึงทรัพยากรจาก upstream โดยคงวงเล็บปีกกา { } ดิบใน path
 * (Node fetch จะ encode {} เป็น %7B อัตโนมัติ ทำให้ tile/font server 404)
 * รองรับ https เท่านั้น (upstream ของแผนที่เป็น https ทั้งหมด)
 */
export function fetchRaw(
  url: string,
  headers: Record<string, string>,
): Promise<{ status: number; contentType: string; body: Buffer }> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') {
      reject(new Error('https only'));
      return;
    }
    const req = https.request(
      {
        host: parsed.host,
        path: `${parsed.pathname}${parsed.search}`,
        method: 'GET',
        headers,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => {
          resolve({
            status: res.statusCode ?? 0,
            contentType: res.headers['content-type'] ?? 'application/octet-stream',
            body: Buffer.concat(chunks),
          });
        });
      },
    );
    req.on('error', reject);
    req.setTimeout(15_000, () => {
      req.destroy(new Error('upstream timeout'));
    });
    req.end();
  });
}
