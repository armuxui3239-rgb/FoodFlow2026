import type { Metadata, Viewport } from 'next';
import { Prompt } from 'next/font/google';
import { AppShell } from '@/components/app-shell';
import './globals.css';

const prompt = Prompt({
  subsets: ['thai', 'latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-prompt',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'ฟู๊ด ธันเดอร์ — สั่งอาหาร ส่งไว ถึงบ้าน',
  description: 'สั่งอาหารจากร้านคุณภาพใกล้คุณ ชำระผ่าน PromptPay ส่งไวถึงมือ',
};

export const viewport: Viewport = {
  themeColor: '#FFC400',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <body className={`${prompt.variable} antialiased`}>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
