import type { NextConfig } from "next";
import { STATIC_SECURITY_HEADERS } from "./src/lib/security/headers";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
      allowedOrigins: ["localhost:3000", "localhost:3001", "127.0.0.1:3000", "127.0.0.1:3001"],
    },
    middlewareClientMaxBodySize: "50mb",
  },
  // Keep pitch deck HTML + images available to the authenticated Sales API on Vercel.
  outputFileTracingIncludes: {
    "/api/sales/pitch-deck": ["./docs/sales/**/*"],
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.supabase.co" },
      { protocol: "https", hostname: "**.facebook.com" },
      { protocol: "https", hostname: "**.instagram.com" },
    ],
  },
  // Content-Security-Policy and X-Frame-Options are set in middleware so the
  // Sales pitch route can allow same-origin framing without a catch-all overwrite.
  async headers() {
    return [{ source: "/:path*", headers: STATIC_SECURITY_HEADERS }];
  },
};

export default nextConfig;
