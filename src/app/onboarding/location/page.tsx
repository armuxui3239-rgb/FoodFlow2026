'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Map as MapLibreMap } from 'maplibre-gl';
import { MapPin, Home, Building2, Store } from 'lucide-react';
import { AuthShell } from '@/components/auth-shell';

const BANGKOK = { lng: 100.5018, lat: 13.7563 };

const LABELS = [
  { key: 'บ้าน', Icon: Home },
  { key: 'ที่ทำงาน', Icon: Building2 },
  { key: 'อื่น ๆ', Icon: Store },
];

export default function LocationSetupPage() {
  const router = useRouter();
  const mapDiv = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const [label, setLabel] = useState('บ้าน');
  const [addressLine, setAddressLine] = useState('');
  const [coords, setCoords] = useState(BANGKOK);
  const [mapReady, setMapReady] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const maplibregl = await import('maplibre-gl');
      if (cancelled || !mapDiv.current) return;
      // worker จากไฟล์ใน public — v6 หาเองไม่ได้ใน Turbopack (import.meta.url ไม่ใช่ http)
      // จึงกำหนดผ่าน config.WORKER_URL ตาม API ทางการของ maplibre
      try {
        maplibregl.config.WORKER_URL = '/maplibre-gl-worker.mjs';
        console.info('[ft-map] WORKER_URL =', maplibregl.config.WORKER_URL);
      } catch (e) {
        console.error('[ft-map] set WORKER_URL failed', e);
      }
      // โหมดปิดสนิทในระบบ: PMTiles จาก Supabase Storage เมื่อตั้งค่า — ปกติใช้ proxy ของเรา
      const { PMTILES_ENABLED, buildPmtilesStyle, ensurePmtilesProtocol } = await import('@/lib/map-pmtiles');
      const pmtilesActive = await ensurePmtilesProtocol();
      // style ผ่าน proxy ของเรา (แคชแผ่นที่ในเครื่อง + User-Agent) — เปลี่ยนต้นทางที่ env เดียว
      const style = pmtilesActive
        ? buildPmtilesStyle()
        : new URL('/api/map/style', window.location.origin).toString();
      const map = new maplibregl.Map({
        container: mapDiv.current,
        style,
        center: [BANGKOK.lng, BANGKOK.lat],
        zoom: 14,
      });
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
      map.on('load', () => !cancelled && setMapReady(true));
      map.on('moveend', () => {
        const c = map.getCenter();
        setCoords({ lng: c.lng, lat: c.lat });
      });
      mapRef.current = map;
    })();
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/onboard/location', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label, addressLine, lat: coords.lat, lng: coords.lng }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? 'บันทึกไม่สำเร็จ');
      router.push(body.next ?? '/onboarding/pin');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'บันทึกไม่สำเร็จ');
      setLoading(false);
    }
  };

  return (
    <AuthShell title="ตั้งค่าที่อยู่จัดส่ง" backHref="/onboarding/profile">
      <div className="relative mb-4 h-64 overflow-hidden rounded-3xl border border-line">
        <div ref={mapDiv} className="h-full w-full" aria-label="แผนที่เลือกตำแหน่ง" />
        {/* หมุดกึ่งกลางคงที่ — เลื่อนแผนที่เพื่อจัดตำแหน่ง */}
        <div className="pointer-events-none absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-full">
          <MapPin className="h-10 w-10 fill-brand text-black drop-shadow" aria-hidden />
        </div>
        {!mapReady && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-neutral-100 text-sm text-ink-soft">
            กำลังโหลดแผนที่ (OpenFreeMap)...
          </div>
        )}
      </div>
      <p className="mb-4 text-xs text-ink-soft">
        เลื่อนแผนที่เพื่อจัดหมุดให้ตรงจุดรับอาหาร — พิกัด: {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
      </p>

      <form onSubmit={submit} className="space-y-4">
        {error && (
          <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </p>
        )}

        <div className="flex gap-2" role="group" aria-label="ป้ายชื่อที่อยู่">
          {LABELS.map(({ key, Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setLabel(key)}
              aria-pressed={label === key}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-full border px-3 py-2.5 text-sm font-medium transition ${
                label === key
                  ? 'border-black bg-brand text-black'
                  : 'border-line bg-white text-ink-soft hover:bg-neutral-50'
              }`}
            >
              <Icon className="h-4 w-4" aria-hidden />
              {key}
            </button>
          ))}
        </div>

        <label className="block">
          <span className="sr-only">ที่อยู่</span>
          <textarea
            value={addressLine}
            onChange={(e) => setAddressLine(e.target.value)}
            placeholder="บ้านเลขที่ ซอย ถนน แขวง/ตำบล เขต/อำเภอ จังหวัด รหัสไปรษณีย์"
            rows={3}
            className="w-full resize-none rounded-2xl border border-line bg-neutral-50 px-4 py-3.5 text-sm text-ink outline-none placeholder:text-neutral-400 focus:border-brand"
            required
          />
        </label>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-full bg-brand py-3.5 text-sm font-bold text-black transition hover:bg-brand-strong disabled:opacity-60"
        >
          {loading ? 'กำลังบันทึก...' : 'ถัดไป'}
        </button>
      </form>
    </AuthShell>
  );
}
