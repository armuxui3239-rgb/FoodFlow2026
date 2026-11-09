'use client';

import { useEffect, useRef } from 'react';
import { Map as MlMap, Marker as MlMarker, NavigationControl, setWorkerUrl } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

// ชี้ worker ไปที่ไฟล์ static ใน public (Turbopack แบนเดิล worker ตรง ๆ ไม่ได้)
setWorkerUrl('/maplibre-gl-worker.mjs');

export interface MapPoint {
  lng: number;
  lat: number;
  label: 'restaurant' | 'dropoff' | 'driver';
}

/** ผืนแผนที่ MapLibre + หมุดจุดรับ/จุดส่ง/ไรเดอร์ (โหลดเฉพาะเบราว์เซอร์เท่านั้น) */
export default function MapCanvas({ points }: { points: MapPoint[] }) {
  const divRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!divRef.current || points.length === 0) return;
    const map = new MlMap({
      container: divRef.current,
      style: '/api/map/style',
      center: [points[0].lng, points[0].lat],
      zoom: 13,
      attributionControl: true,
    });
    map.addControl(new NavigationControl({ showCompass: false }), 'top-right');

    const colors: Record<string, string> = {
      restaurant: '#000000',
      dropoff: '#FFC400',
      driver: '#555555',
    };
    map.on('load', () => {
      for (const p of points) {
        const el = document.createElement('div');
        el.style.cssText = `width:22px;height:22px;border-radius:9999px;background:${colors[p.label]};border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)`;
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

  return <div ref={divRef} className="h-full w-full" aria-label="แผนที่เส้นทางจัดส่ง" />;
}
