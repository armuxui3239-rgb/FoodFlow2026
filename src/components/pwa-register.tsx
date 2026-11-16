'use client';

import { useEffect } from 'react';

/** ลงทะเบียน Service Worker สำหรับมาตรฐาน PWA (standalone + offline fallback) */
export function PwaRegister() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {
      // ข้ามเงียบๆ หากเบราว์เซอร์ปิด service worker
    });
  }, []);

  return null;
}
