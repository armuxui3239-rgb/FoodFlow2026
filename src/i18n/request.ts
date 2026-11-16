import { getRequestConfig } from 'next-intl/server';
import { cookies } from 'next/headers';
import th from '@/messages/th.json';
import en from '@/messages/en.json';

/** แหล่งภาษากลางของ next-intl — อ่านจาก cookie 'ft_locale' (ปุ่มสลับภาษา) ค่าเริ่มต้นไทย */
export default getRequestConfig(async () => {
  const store = await cookies();
  const locale = store.get('ft_locale')?.value === 'en' ? 'en' : 'th';
  return { locale, messages: locale === 'en' ? en : th };
});
