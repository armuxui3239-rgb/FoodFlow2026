import { NextRequest, NextResponse } from 'next/server';

/**
 * ประตูกันผู้เยี่ยมชม (Guest Gate) + ความปลอดภัย API — ตามมาตรฐานแอปสั่งอาหารระดับโลก
 *
 * ผู้ที่ยังไม่มี session (ไม่ได้ล็อกอิน) จะต้องไม่เห็นหน้ารายการร้าน/ตะกร้า/ออเดอร์:
 *  1) เข้าครั้งแรก (ไม่เคยดู intro)  → /onboarding/intro  (สไลด์ภาพจริงเต็มจอ)
 *  2) เคยดู intro แล้ว              → /login?next=<หน้าเดิม>
 *  3) มี session                    → ผ่านได้ทุกหน้า
 *
 * เฟส 9 (v4 ข้อ 11): rate limit รวมระดับ IP สำหรับ /api/** + ตรวจ Origin คำขอ mutation
 * เส้นทางสาธารณะ: หน้ายืนยันตัวตนทั้งหมด + onboarding (จัดการ 401 ที่ route เอง)
 */
const PUBLIC_PATHS = ['/login', '/register', '/verify-otp', '/forgot-pin', '/onboarding'];

// ---- rate limit รวม (in-memory ต่ออินสแตนซ์ — เพียงพอสำหรับอินสแตนซ์เดียว/ขนาดเล็ก) ----
const RATE_BUCKETS = new Map<string, { count: number; resetAt: number }>();
const RATE_CLEANUP_EVERY = 5000;

function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const bucket = RATE_BUCKETS.get(key);
  if (!bucket || bucket.resetAt < now) {
    RATE_BUCKETS.set(key, { count: 1, resetAt: now + windowMs });
    if (RATE_BUCKETS.size > RATE_CLEANUP_EVERY) {
      for (const [k, b] of RATE_BUCKETS) if (b.resetAt < now) RATE_BUCKETS.delete(k);
    }
    return true;
  }
  bucket.count += 1;
  return bucket.count <= limit;
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ---- เฟส 9: rate limit รวมสำหรับ /api/** (auth 20/นาที/IP · อื่น ๆ 120/นาที/IP) ----
  if (pathname.startsWith('/api/')) {
    const ip = (request.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'local';
    const isAuth = pathname.startsWith('/api/auth/');
    if (!rateLimit(`${ip}:${isAuth ? 'auth' : 'api'}`, isAuth ? 20 : 120, 60_000)) {
      return NextResponse.json(
        { error: 'คำขอถี่เกินไป กรุณาลองใหม่ภายหลัง' },
        { status: 429 },
      );
    }
    // ตรวจ Origin คำขอ mutation (CSRF เกรดสอง — cookie SameSite=Lax ครอบชั้นแรกอยู่แล้ว)
    const method = request.method.toUpperCase();
    if (method !== 'GET' && method !== 'HEAD') {
      const origin = request.headers.get('origin');
      if (origin) {
        const host = request.headers.get('host');
        try {
          if (host && new URL(origin).host !== host) {
            return NextResponse.json(
              { error: 'คำขอจากแหล่งที่ไม่ได้รับอนุญาต' },
              { status: 403 },
            );
          }
        } catch {
          // origin รูปแบบไม่ถูกต้อง — ปล่อยผ่านให้ route เองตัดสิน
        }
      }
    }
    return NextResponse.next();
  }

  // ---- ประตูตามบทบาท: /owner, /driver, /admin สำหรับบทบาทนั้นๆ เท่านั้น ----
  const ROLE_GATES: [prefix: string, role: string, portal: string][] = [
    ['/owner', 'restaurant', '/owner'],
    ['/driver', 'driver', '/driver'],
    ['/admin', 'admin', '/admin'],
  ];
  const sessionCookie = request.cookies.get('ft_session')?.value;

  if (sessionCookie) {
    const gate = ROLE_GATES.find(([p]) => pathname === p || pathname.startsWith(`${p}/`));
    if (gate) {
      let role: string | undefined;
      try {
        const [payload] = sessionCookie.split('.');
        role = (JSON.parse(Buffer.from(payload, 'base64url').toString()) as { role?: string }).role;
      } catch {
        role = undefined;
      }
      // มี session แต่บทบาทไม่ตรง → พาไป portal ของบทบาทตัวเอง (ลูกค้า → หน้าแรก)
      if (role && role !== gate[1]) {
        const url = request.nextUrl.clone();
        url.pathname = role === 'restaurant' ? '/owner' : role === 'driver' ? '/driver' : role === 'admin' ? '/admin' : '/';
        url.search = '';
        return NextResponse.redirect(url);
      }
    }
  }

  // มี session → ผ่านทุกหน้า
  if (sessionCookie) {
    return NextResponse.next();
  }

  // หน้าสาธารณะ: ล็อกอิน/สมัคร/onboarding → ผ่าน
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  if (isPublic) {
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();

  // ยังไม่เคยดูหน้าแนะนำ → พาไปดูสไลด์ภาพเต็มจอก่อนเสมอ
  if (!request.cookies.get('ft_intro_seen')?.value) {
    url.pathname = '/onboarding/intro';
    url.search = '';
    return NextResponse.redirect(url);
  }

  // เคยดูแล้วแต่ยังไม่ล็อกอิน → หน้าล็อกอิน พร้อมจุดกลับ
  url.pathname = '/login';
  url.search = `?next=${encodeURIComponent(pathname)}`;
  return NextResponse.redirect(url);
}

export const config = {
  // รวม /api เพื่อครอบ rate limit + Origin check — ข้ามไฟล์ static (_next และไฟล์มีนามสกุล)
  matcher: ['/((?!_next/static|_next/image|.*\\..*).*)'],
};
