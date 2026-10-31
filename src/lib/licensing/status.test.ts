import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { computeLicenseInfo, licenseStatusLabel } from "./status.ts";
import { generateLicenseKey, normalizeLicenseKey } from "./keys.ts";

describe("normalizeLicenseKey", () => {
  it("uppercases and strips junk", () => {
    assert.equal(normalizeLicenseKey("  ccc-ab12-cd34-ef56-gh78  "), "CCC-AB12-CD34-EF56-GH78");
  });
});

describe("generateLicenseKey", () => {
  it("returns CCC-XXXX-XXXX-XXXX-XXXX shape", () => {
    const key = generateLicenseKey();
    assert.match(key, /^CCC-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
  });
});

describe("computeLicenseInfo", () => {
  it("treats empty row as missing and blocked", () => {
    const info = computeLicenseInfo(null);
    assert.equal(info.status, "missing");
    assert.equal(info.allowsAccess, false);
    assert.equal(info.allowsWrite, false);
  });

  it("marks active before expiry", () => {
    const expires = new Date(Date.now() + 30 * 86_400_000).toISOString();
    const info = computeLicenseInfo({
      tenant_id: "t1",
      license_key: "CCC-AAAA-BBBB-CCCC-DDDD",
      status: "active",
      starts_at: new Date().toISOString(),
      expires_at: expires,
      grace_ends_at: new Date(Date.now() + 37 * 86_400_000).toISOString(),
    });
    assert.equal(info.status, "active");
    assert.equal(info.allowsAccess, true);
    assert.equal(info.allowsWrite, true);
    assert.ok((info.daysRemaining ?? 0) >= 29);
  });

  it("enters grace after expiry but before grace end", () => {
    const expires = new Date(Date.now() - 2 * 86_400_000).toISOString();
    const grace = new Date(Date.now() + 5 * 86_400_000).toISOString();
    const info = computeLicenseInfo({
      tenant_id: "t1",
      license_key: "CCC-AAAA-BBBB-CCCC-DDDD",
      status: "active",
      expires_at: expires,
      grace_ends_at: grace,
    });
    assert.equal(info.status, "grace");
    assert.equal(info.allowsAccess, true);
    assert.equal(info.allowsWrite, false);
  });

  it("expires after grace ends", () => {
    const expires = new Date(Date.now() - 20 * 86_400_000).toISOString();
    const grace = new Date(Date.now() - 10 * 86_400_000).toISOString();
    const info = computeLicenseInfo({
      tenant_id: "t1",
      license_key: "CCC-AAAA-BBBB-CCCC-DDDD",
      status: "active",
      expires_at: expires,
      grace_ends_at: grace,
    });
    assert.equal(info.status, "expired");
    assert.equal(info.allowsAccess, false);
    assert.equal(licenseStatusLabel("expired"), "Expired");
  });
});
