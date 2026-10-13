import { NextResponse } from "next/server";

/**
 * Digital Asset Links for the CCC HQ Trusted Web Activity (package ng.ccc.hq).
 * Fingerprint matches apps/hq-android preview keystore (see docs/HQ-MOBILE.md).
 * Replace sha256_cert_fingerprints when you rotate the upload key for Play.
 */
const ASSET_LINKS = [
  {
    relation: ["delegate_permission/common.handle_all_urls"],
    target: {
      namespace: "android_app",
      package_name: "ng.ccc.hq",
      sha256_cert_fingerprints: [
        "43:1C:9D:C5:C1:74:01:36:8E:5A:DD:59:A8:72:95:BB:29:C6:D6:9A:7A:44:C9:64:0F:1B:68:F2:24:56:FA:74",
      ],
    },
  },
];

export function GET() {
  return NextResponse.json(ASSET_LINKS, {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
