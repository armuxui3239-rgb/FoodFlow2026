'use client';

import type { StyleSpecification } from 'maplibre-gl';

/**
 * โหมดแผนที่ปิดสนิทในระบบ (นโยบายจบในระบบ บน Supabase เท่านั้น)
 *
 * เมื่อตั้ง NEXT_PUBLIC_MAP_PMTILES_URL เป็น URL ไฟล์ .pmtiles บน Supabase Storage
 * แผนที่จะอ่าน tile จากไฟล์นั้นโดยตรง (byte-range ผ่าน Storage) — ไม่ยิงออก tile host ภายนอกเลย
 * ข้อมูลแผนที่ = OpenStreetMap (โอเพน ODbL) รูปแบบไฟล์ PMTiles (โอเพนซอร์ส BSD-3)
 *
 * ถ้าไม่ตั้งค่า → ระบบใช้ /api/map/style ผ่าน proxy ของเราเหมือนเดิม (โอเพนซอร์สครบอยู่แล้ว)
 */

export const PMTILES_URL = process.env.NEXT_PUBLIC_MAP_PMTILES_URL ?? '';

export const PMTILES_ENABLED = PMTILES_URL.startsWith('https://');

let registered = false;

/** ลงทะเบียน pmtiles:// protocol กับ MapLibre (pmtiles v4 = new Protocol() + addProtocol) — เรียกซ้ำได้ */
export async function ensurePmtilesProtocol(): Promise<boolean> {
  if (!PMTILES_ENABLED || registered) return PMTILES_ENABLED && registered;
  try {
    const [{ Protocol }, maplibregl] = await Promise.all([
      import('pmtiles'),
      import('maplibre-gl'),
    ]);
    const protocol = new Protocol();
    maplibregl.addProtocol('pmtiles', protocol.tile);
    registered = true;
    return true;
  } catch {
    return false;
  }
}

/**
 * Style JSON แบบเรียบสำหรับ PMTiles (protomaps layer names)
 * ใช้เมื่อ PMTILES_ENABLED — เพียงพอสำหรับติดตามการจัดส่ง
 */
export function buildPmtilesStyle(): StyleSpecification {
  return {
    version: 8,
    sources: {
      pmtiles: {
        type: 'vector',
        url: `pmtiles://${PMTILES_URL}`,
        attribution: '© OpenStreetMap contributors (ODbL) — PMTiles',
      },
    },
    layers: [
      { id: 'bg', type: 'background', paint: { 'background-color': '#f4f2ee' } },
      { id: 'earth', type: 'fill', source: 'pmtiles', 'source-layer': 'earth', paint: { 'fill-color': '#e8e4d8' } },
      { id: 'water', type: 'fill', source: 'pmtiles', 'source-layer': 'water', paint: { 'fill-color': '#a8c8e8' } },
      {
        id: 'roads-minor',
        type: 'line',
        source: 'pmtiles',
        'source-layer': 'roads',
        minzoom: 11,
        paint: { 'line-color': '#ffffff', 'line-width': 1.5 },
      },
      {
        id: 'roads-major',
        type: 'line',
        source: 'pmtiles',
        'source-layer': 'roads',
        paint: { 'line-color': '#e6d8a8', 'line-width': 4 },
      },
      {
        id: 'buildings',
        type: 'fill',
        source: 'pmtiles',
        'source-layer': 'buildings',
        minzoom: 13,
        paint: { 'fill-color': '#dedad0' },
      },
      {
        id: 'places-label',
        type: 'symbol',
        source: 'pmtiles',
        'source-layer': 'places',
        minzoom: 6,
        layout: { 'text-field': ['get', 'name'], 'text-size': 12 },
        paint: { 'text-color': '#333333' },
      },
    ],
  };
}
