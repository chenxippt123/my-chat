import type { NextConfig } from "next";

/**
 * Dev-only: allow loading `/_next/*` when the app is opened via LAN IP (e.g. http://192.168.0.248:3000).
 * Without this, Next blocks those requests (Origin hostname ≠ localhost) and auth pages break.
 * @see https://nextjs.org/docs/app/api-reference/config/next-config-js/allowedDevOrigins
 */
const privateLanOrigins = [
  "192.168.*.*",
  "10.*.*.*",
  ...Array.from({ length: 16 }, (_, i) => `172.${16 + i}.*.*`),
];

const nextConfig: NextConfig = {
  turbopack: {
    root: ".",
  },
  allowedDevOrigins: privateLanOrigins,
};

export default nextConfig;
