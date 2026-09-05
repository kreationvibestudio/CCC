import assert from "node:assert/strict";
import { test } from "node:test";
import { STATIC_SECURITY_HEADERS, buildCsp } from "./headers.ts";

function directive(csp: string, name: string): string {
  const found = csp
    .split(";")
    .map((part) => part.trim())
    .find((part) => part === name || part.startsWith(`${name} `));
  assert.ok(found, `missing directive ${name} in: ${csp}`);
  return found;
}

test("scripts are nonce-gated and cannot fall back to inline", () => {
  const csp = buildCsp({ nonce: "abc123" });
  const script = directive(csp, "script-src");
  assert.match(script, /'nonce-abc123'/);
  assert.match(script, /'strict-dynamic'/);
  assert.doesNotMatch(script, /'unsafe-inline'/);
  assert.doesNotMatch(script, /'unsafe-eval'/);
});

test("dev adds eval and websockets, production does not", () => {
  const dev = buildCsp({ nonce: "n", dev: true });
  assert.match(directive(dev, "script-src"), /'unsafe-eval'/);
  assert.match(directive(dev, "connect-src"), /wss:/);
  assert.doesNotMatch(dev, /upgrade-insecure-requests/);

  const prod = buildCsp({ nonce: "n" });
  assert.doesNotMatch(directive(prod, "script-src"), /'unsafe-eval'/);
  assert.doesNotMatch(directive(prod, "connect-src"), /wss:/);
  assert.match(prod, /upgrade-insecure-requests/);
});

test("the Supabase origin is reachable over https and websockets", () => {
  const csp = buildCsp({ nonce: "n", supabaseUrl: "https://abc.supabase.co/" });
  const connect = directive(csp, "connect-src");
  assert.match(connect, /https:\/\/abc\.supabase\.co/);
  assert.match(connect, /wss:\/\/abc\.supabase\.co/);
  // Signed storage URLs render as <img>/<video>.
  assert.match(directive(csp, "img-src"), /https:\/\/abc\.supabase\.co/);
  assert.match(directive(csp, "media-src"), /https:\/\/abc\.supabase\.co/);
});

test("a missing or malformed Supabase URL does not produce a broken directive", () => {
  for (const supabaseUrl of [undefined, "", "   ", "not-a-url", "[SENSITIVE]"]) {
    const csp = buildCsp({ nonce: "n", supabaseUrl });
    assert.equal(directive(csp, "connect-src"), "connect-src 'self' https://api.mapbox.com https://*.tile.openstreetmap.org");
    assert.doesNotMatch(csp, /undefined|null/);
  }
});

test("clickjacking and base-tag injection are closed off", () => {
  const csp = buildCsp({ nonce: "n" });
  assert.equal(directive(csp, "frame-ancestors"), "frame-ancestors 'none'");
  assert.equal(directive(csp, "base-uri"), "base-uri 'self'");
  assert.equal(directive(csp, "object-src"), "object-src 'none'");
});

test("Paystack can receive checkout form posts", () => {
  assert.match(directive(buildCsp({ nonce: "n" }), "form-action"), /paystack/);
});

test("map tiles and blob previews stay loadable", () => {
  const img = directive(buildCsp({ nonce: "n" }), "img-src");
  assert.match(img, /tile\.openstreetmap\.org/);
  assert.match(img, /api\.mapbox\.com/);
  assert.match(img, /blob:/);
  assert.match(img, /data:/);
});

test("the field agent portal keeps geolocation and camera", () => {
  const permissions = STATIC_SECURITY_HEADERS.find((h) => h.key === "Permissions-Policy");
  assert.ok(permissions);
  assert.match(permissions.value, /geolocation=\(self\)/);
  assert.match(permissions.value, /camera=\(self\)/);
  assert.match(permissions.value, /microphone=\(\)/);
});

test("static headers cover sniffing, framing and transport", () => {
  const byKey = new Map(STATIC_SECURITY_HEADERS.map((h) => [h.key, h.value]));
  assert.equal(byKey.get("X-Content-Type-Options"), "nosniff");
  assert.equal(byKey.get("X-Frame-Options"), "DENY");
  assert.equal(byKey.get("Referrer-Policy"), "strict-origin-when-cross-origin");
  assert.match(byKey.get("Strict-Transport-Security") ?? "", /max-age=\d{7,}/);
});
