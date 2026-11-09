#!/usr/bin/env bash
# สคริปต์วัดทรัพยากรที่ใช้จริงของบริการโอเพนซอร์ส (แพตช์ v3.1 ข้อ 4)
# ---------------------------------------------------------------
# ทำไมต้องมีสคริปต์นี้: แซนด์บ็อกซ์พัฒนาไม่มี Docker/Go/sudo จึง "ห้ามเดาตัวเลข"
# ให้รันสคริปต์นี้บนเครื่องเป้าหมาย (Railway ผ่าน log หรือเครื่องของคุณ) แล้วส่งผลลัพธ์กลับ
# ผลลัพธ์จะถูกใช้ตัดสิน: ตัวไหนรันบน Railway ได้ / ตัวไหนต้องรันบนเครื่องของคุณ
#
# วิธีใช้: chmod +x scripts/measure-resources.sh && ./scripts/measure-resources.sh
# ---------------------------------------------------------------
set -u
interval="${1:-60}"   # ระยะเวลาวัดต่อบริการ (วินาที) default 60

hdr() { printf '\n=== %s ===\n' "$1"; }

snap() { # $1 = pattern ของ process
  ps -eo pid,comm,rss,pcpu --sort=-rss | awk -v p="$1" '$0 ~ p {print}' | head -5
}

hdr "ทรัพยากรเครื่องรวม"
free -h 2>/dev/null || vm_stat 2>/dev/null | head -3
nproc 2>/dev/null || sysctl -n hw.ncpu 2>/dev/null

for svc in "OSRM:osrm" "Geocoder:photon" "Geocoder2:nominatim" "ntfy:ntfy" \
           "TileServer:tile" "TileServer2:protomaps" "SMS-GatewayServer:sms-gateway" \
           "MariaDB:mariadbd" "MariaDB2:mysqld" "LiveKit:livekit" "coturn:turnserver"; do
  name="${svc%%:*}"; pat="${svc#*:}"
  hdr "$name (RSS KB / CPU%)"
  snap "$pat"
done

hdr "Docker stats (ถ้าใช้ Docker รันบริการเหล่านี้)"
if command -v docker >/dev/null 2>&1; then
  docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}" 2>/dev/null
else
  echo "(ไม่มี docker บนเครื่องนี้ — ข้าม)"
fi

hdr "คำแนะนำการวัดแบบต่อเนื่อง ${interval}s"
echo "รัน: watch -n 5 './scripts/measure-resources.sh' ระหว่างมี traffic จริง"
echo "หรือบน Railway: ใช้หน้า Metrics ของแต่ละ service แล้วจดค่า Memory/CPU ขณะทดสอบส่ง SMS/โหลดแผนที่"
