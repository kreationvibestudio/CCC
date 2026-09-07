import type { NextConfig } from "next";
import { STATIC_SECURITY_HEADERS } from "./src/lib/security/headers";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
    middlewareClientMaxBodySize: "50mb",
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.supabase.co" },
      { protocol: "https", hostname: "**.facebook.com" },
      { protocol: "https", hostname: "**.instagram.com" },
    ],
  },
  // Content-Security-Policy is set in middleware instead: it carries a
  // per-request nonce, which a static header cannot.
  async headers() {
    return [{ source: "/:path*", headers: STATIC_SECURITY_HEADERS }];
  },
};

export default nextConfig;
