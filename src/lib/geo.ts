import 'server-only';

/**
 * ถอดรหัสพิกัดจาก hex EWKB ของ PostGIS (Point SRID 4326)
 * โครง: 8 ไบต์หัว (01 01 00 00 20 E6 10 00 00) + lng (double LE) + lat (double LE)
 * คืน [lng, lat] ตามลำดับที่ maplibre ใช้ หรือ null ถ้าข้อมูลไม่ใช่ point
 */
export function decodeWkbPoint(hex: string | null | undefined): [number, number] | null {
  if (!hex || hex.length < 42) return null;
  try {
    const buf = Buffer.from(hex, 'hex');
    // byte 0 = endianness, byte 1-3 = type, byte 4 = has SRID flag, byte 5-8 = SRID 4326
    if (buf.length < 21) return null;
    const little = buf[0] === 1;
    const lng = little ? buf.readDoubleLE(9) : buf.readDoubleBE(9);
    const lat = little ? buf.readDoubleLE(17) : buf.readDoubleBE(17);
    if (Number.isNaN(lng) || Number.isNaN(lat)) return null;
    return [lng, lat];
  } catch {
    return null;
  }
}
