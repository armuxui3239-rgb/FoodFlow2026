'use client';

import { useEffect, useRef } from 'react';
import { Map as MlMap, Marker as MlMarker, NavigationControl, setWorkerUrl } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

// ชี้ worker ไปที่ไฟล์ static ใน public (แบบเดียวกับหน้าแผนที่ออเดอร์)
setWorkerUrl('/maplibre-gl-worker.mjs');

export interface DriverPoint {
  lng: number;
  lat: number;
  label: string;
}

/** ผืนแผนที่ MapLibre + หมุดไรเดอร์สีแบรนด์ (โหลดเฉพาะเบราว์เซอร์เท่านั้น) */
export default function DriverMap({ points }: { points: DriverPoint[] }) {
  const divRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!divRef.current || points.length === 0) return;
    const map = new MlMap({
      container: divRef.current,
      style: '/api/map/style',
      center: [points[0].lng, points[0].lat],
      zoom: 11,

    });
    map.addControl(new NavigationControl({ showCompass: false }), 'top-right');

    map.on('load', () => {
      for (const p of points) {
        const el = document.createElement('div');
        el.title = p.label;
        // หมุดไรเดอร์ — สีเหลืองแบรนด์พร้อมขอบขาว
        el.style.cssText =
          'width:22px;height:22px;border-radius:9999px;background:#FFC400;border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)';
        new MlMarker({ element: el }).setLngLat([p.lng, p.lat]).addTo(map);
      }
      const lons = points.map((p) => p.lng);
      const lats = points.map((p) => p.lat);
      map.fitBounds(
        [
          [Math.min(...lons), Math.min(...lats)],
          [Math.max(...lons), Math.max(...lats)],
        ],
        { padding: 80, maxZoom: 15, duration: 400 },
      );
    });

    return () => map.remove();
  }, [points]);

  return <div ref={divRef} className="h-full w-full" aria-label="แผนที่ตำแหน่งไรเดอร์ออนไลน์" />;
}
