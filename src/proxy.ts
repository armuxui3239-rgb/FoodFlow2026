import { NextRequest, NextResponse } from 'next/server';

/**
 * ประตูกันผู้เยี่ยมชม (Guest Gate) — ตามมาตรฐานแอปสั่งอาหารระดับโลก
 *
 * ผู้ที่ยังไม่มี session (ไม่ได้ล็อกอิน) จะต้องไม่เห็นหน้ารายการร้าน/ตะกร้า/ออเดอร์:
 *  1) เข้าครั้งแรก (ไม่เคยดู intro)  → /onboarding/intro  (สไลด์ภาพจริงเต็มจอ)
 *  2) เคยดู intro แล้ว              → /login?next=<หน้าเดิม>
 *  3) มี session                    → ผ่านได้ทุกหน้า
 *
 * เส้นทางสาธารณะ: หน้ายืนยันตัวตนทั้งหมด + onboarding + /api (จัดการ 401 ที่ route เอง)
 */
const PUBLIC_PATHS = ['/login', '/register', '/verify-otp', '/forgot-pin', '/onboarding'];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // มี session → ผ่านทุกหน้า
  if (request.cookies.get('ft_session')?.value) {
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
  // ข้าม: api, ไฟล์ static (_next และไฟล์ที่มีนามสกุล เช่น .jpg .svg .mjs .txt)
  matcher: ['/((?!api|_next/static|_next/image|.*\\..*).*)'],
};
