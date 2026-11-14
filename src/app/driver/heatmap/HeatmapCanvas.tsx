'use client';

import { useEffect, useRef } from 'react';
import { Map as MlMap, Marker as MlMarker, NavigationControl, setWorkerUrl } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

// ชี้ worker ไปที่ไฟล์ static ใน public (Turbopack แบนเดิล worker ตรง ๆ ไม่ได้)
setWorkerUrl('/maplibre-gl-worker.mjs');

export interface HeatPoint {
  lng: number;
  lat: number;
  name: string;
  orderCount: number;
  color: string;
}

/** ผืนแผนที่ MapLibre สำหรับ heatmap ความต้องการจัดส่ง (โหลดเฉพาะเบราว์เซอร์เท่านั้น) */
export default function HeatmapCanvas({ points }: { points: HeatPoint[] }) {
  const divRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!divRef.current || points.length === 0) return;
    const map = new MlMap({
      container: divRef.current,
      style: '/api/map/style',
      center: [points[0].lng, points[0].lat],
      zoom: 12,

    });
    map.addControl(new NavigationControl({ showCompass: false }), 'top-right');

    map.on('load', () => {
      for (const p of points) {
        // หมุดวงกลม — ขนาดและสีตามจำนวนออเดอร์ (สีมาจากหน้า page เพื่อให้ legend ตรงกัน)
        const size = Math.min(30, 16 + p.orderCount);
        const el = document.createElement('div');
        el.title = `${p.name} · ${p.orderCount} ออเดอร์ใน 7 วันล่าสุด`;
        el.style.cssText = `width:${size}px;height:${size}px;border-radius:9999px;background:${p.color};border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)`;
        new MlMarker({ element: el }).setLngLat([p.lng, p.lat]).addTo(map);
      }
      const lons = points.map((p) => p.lng);
      const lats = points.map((p) => p.lat);
      map.fitBounds(
        [
          [Math.min(...lons), Math.min(...lats)],
          [Math.max(...lons), Math.max(...lats)],
        ],
        { padding: 80, maxZoom: 14, duration: 400 },
      );
    });

    return () => map.remove();
  }, [points]);

  return <div ref={divRef} className="h-full w-full" aria-label="แผนที่ความต้องการจัดส่ง" />;
}
