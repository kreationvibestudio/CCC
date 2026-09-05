/**
 * Security response headers.
 *
 * The static ones are attached in next.config.ts so they cover every route,
 * including the paths the middleware matcher skips. The Content-Security-Policy
 * carries a per-request nonce, so it has to be built in middleware instead.
 */

export type CspOptions = {
  nonce: string;
  /** Dev needs eval for React Refresh and websockets for HMR. */
  dev?: boolean;
  /** NEXT_PUBLIC_SUPABASE_URL. Origin is allowed for XHR, images and websockets. */
  supabaseUrl?: string;
  /** Extra origins the deployment needs to reach, e.g. a self-hosted tile server. */
  extraConnectSrc?: string[];
};

/** Map tiles, Facebook/Instagram media and Paystack checkout are all cross-origin. */
const IMG_ORIGINS = [
  "https://*.tile.openstreetmap.org",
  "https://api.mapbox.com",
  "https://*.fbcdn.net",
  "https://*.facebook.com",
  "https://*.cdninstagram.com",
];

const CONNECT_ORIGINS = ["https://api.mapbox.com", "https://*.tile.openstreetmap.org"];

const FORM_ORIGINS = ["https://paystack.com", "https://*.paystack.com", "https://paystack.shop"];

function originOf(raw: string | undefined): string | null {
  const value = (raw ?? "").trim();
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

export function buildCsp({ nonce, dev = false, supabaseUrl, extraConnectSrc = [] }: CspOptions): string {
  const supabase = originOf(supabaseUrl);
  const supabaseWs = supabase ? supabase.replace(/^http/, "ws") : null;

  const connect = [
    "'self'",
    ...CONNECT_ORIGINS,
    ...(supabase ? [supabase, supabaseWs!] : []),
    ...extraConnectSrc,
    // Turbopack's HMR channel.
    ...(dev ? ["ws:", "wss:"] : []),
  ];

  // 'strict-dynamic' lets the nonced Next bootstrap load the rest of the chunks,
  // and makes the host allowlist redundant for scripts — an injected <script src>
  // without the nonce is refused.
  const script = ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'", ...(dev ? ["'unsafe-eval'"] : [])];

  const directives: Array<[string, string[]]> = [
    ["default-src", ["'self'"]],
    ["script-src", script],
    // Next, Tailwind and Leaflet all set element styles inline. Nonces cannot
    // cover those, so inline styles stay allowed.
    ["style-src", ["'self'", "'unsafe-inline'"]],
    ["img-src", ["'self'", "data:", "blob:", ...IMG_ORIGINS, ...(supabase ? [supabase] : [])]],
    ["font-src", ["'self'", "data:"]],
    ["connect-src", connect],
    ["media-src", ["'self'", "blob:", ...(supabase ? [supabase] : [])]],
    ["worker-src", ["'self'", "blob:"]],
    ["manifest-src", ["'self'"]],
    ["object-src", ["'none'"]],
    ["base-uri", ["'self'"]],
    ["form-action", ["'self'", ...FORM_ORIGINS]],
    ["frame-ancestors", ["'none'"]],
    ["frame-src", ["'self'"]],
  ];

  const policy = directives.map(([name, values]) => `${name} ${values.join(" ")}`);
  // Vercel terminates TLS; without this, a single http:// asset reference would
  // downgrade the whole page.
  if (!dev) policy.push("upgrade-insecure-requests");

  return policy.join("; ");
}

/**
 * Headers that never vary per request. `geolocation` and `camera` stay enabled
 * because the field agent portal needs both to capture a polling unit report.
 */
export const STATIC_SECURITY_HEADERS: Array<{ key: string; value: string }> = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  {
    key: "Permissions-Policy",
    value: [
      "accelerometer=()",
      "autoplay=()",
      "camera=(self)",
      "display-capture=()",
      "encrypted-media=()",
      "geolocation=(self)",
      "gyroscope=()",
      "magnetometer=()",
      "microphone=()",
      "midi=()",
      "payment=()",
      "usb=()",
      "xr-spatial-tracking=()",
    ].join(", "),
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];
