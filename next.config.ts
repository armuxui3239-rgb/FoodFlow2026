import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  async rewrites() {
    return [
      // maplibre-gl v6 หา worker ไฟล์ relative กับตำแหน่ง bundle ของมันเอง
      // (_next/static/chunks/maplibre-gl-worker.mjs) — ชี้กลับไปที่ไฟล์จริงใน public/
      {
        source: "/_next/static/chunks/maplibre-gl-worker.mjs",
        destination: "/maplibre-gl-worker.mjs",
      },
      {
        source: "/_next/static/chunks/maplibre-gl-worker-dev.mjs",
        destination: "/maplibre-gl-worker.mjs",
      },
    ];
  },
};

export default nextConfig;
