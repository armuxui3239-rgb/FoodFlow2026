import type { Metadata, Viewport } from 'next';
import { cookies } from 'next/headers';
import { NextIntlClientProvider } from 'next-intl';
import { Prompt } from 'next/font/google';
import { AppShell } from '@/components/app-shell';
import { PwaRegister } from '@/components/pwa-register';
import { AudioUnlockBanner } from '@/components/sound/audio-unlock-banner';
import thMessages from '@/messages/th.json';
import enMessages from '@/messages/en.json';
import './globals.css';

const MESSAGES = { th: thMessages, en: enMessages } as const;
type Locale = keyof typeof MESSAGES;

const prompt = Prompt({
  subsets: ['thai', 'latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-prompt',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'ฟู๊ด ธันเดอร์ — สั่งอาหาร ส่งไว ถึงบ้าน',
  description: 'สั่งอาหารจากร้านคุณภาพใกล้คุณ ชำระผ่าน PromptPay ส่งไวถึงมือ',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Food Thunder',
  },
  icons: {
    apple: '/icons/icon-192.png',
  },
};

export const viewport: Viewport = {
  themeColor: '#FFC400',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // ภาษาจาก cookie 'ft_locale' (ปุ่มสลับภาษาตั้งค่า) — ค่าเริ่มต้นไทย
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get('ft_locale')?.value;
  const locale: Locale = cookieLocale === 'en' ? 'en' : 'th';

  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        {/* ธีมก่อนวาดจอ (กันวาบขาว): ค่าที่บันทึกไว้ > ค่าระบบปฏิบัติการ > โหมดสว่าง */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{var t=localStorage.getItem('ft_theme');if(t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme: dark)').matches))document.documentElement.classList.add('dark')}catch(e){}",
          }}
        />
      </head>
      <body className={`${prompt.variable} antialiased`}>
        <PwaRegister />
        <NextIntlClientProvider locale={locale} messages={MESSAGES[locale]}>
          <AppShell>{children}</AppShell>
          <AudioUnlockBanner />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
