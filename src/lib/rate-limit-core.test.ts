import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  clientIp,
  localRateLimit,
  rateLimitKey,
  resetLocalRateLimits,
  RATE_LIMITS,
} from "./rate-limit-core.ts";

beforeEach(() => resetLocalRateLimits());

describe("rateLimitKey", () => {
  it("namespaces by bucket and normalises identity", () => {
    assert.equal(rateLimitKey("agentCodeLogin", "203.0.113.9"), "agentCodeLogin:203.0.113.9");
    assert.equal(rateLimitKey("publicSignup", "  A@B.COM "), "publicSignup:a@b.com");
  });

  it("falls back when identity is blank", () => {
    assert.equal(rateLimitKey("eventCheckIn", "   "), "eventCheckIn:unknown");
  });

  it("stays short enough for a text primary key", () => {
    assert.ok(rateLimitKey("aiChat", "x".repeat(500)).length <= 180);
  });
});

describe("clientIp", () => {
  it("takes the first x-forwarded-for hop", () => {
    const headers = new Headers({ "x-forwarded-for": "203.0.113.9, 70.41.3.18, 150.172.238.178" });
    assert.equal(clientIp(headers), "203.0.113.9");
  });

  it("falls back through the other proxy headers", () => {
    assert.equal(clientIp(new Headers({ "x-real-ip": "198.51.100.4" })), "198.51.100.4");
    assert.equal(clientIp(new Headers({ "cf-connecting-ip": "198.51.100.5" })), "198.51.100.5");
    assert.equal(clientIp(new Headers()), "unknown");
  });
});

describe("localRateLimit", () => {
  it("allows up to the limit then blocks", () => {
    const rule = { limit: 3, windowSeconds: 60 };
    for (let i = 0; i < 3; i += 1) {
      assert.equal(localRateLimit("k", rule, 1000).allowed, true, `hit ${i + 1}`);
    }
    const blocked = localRateLimit("k", rule, 1000);
    assert.equal(blocked.allowed, false);
    assert.equal(blocked.retryAfterSeconds, 60);
  });

  it("starts a fresh window once the old one expires", () => {
    const rule = { limit: 1, windowSeconds: 10 };
    assert.equal(localRateLimit("k", rule, 0).allowed, true);
    assert.equal(localRateLimit("k", rule, 5_000).allowed, false);
    assert.equal(localRateLimit("k", rule, 10_000).allowed, true);
  });

  it("counts each key separately", () => {
    const rule = { limit: 1, windowSeconds: 60 };
    assert.equal(localRateLimit("a", rule, 0).allowed, true);
    assert.equal(localRateLimit("b", rule, 0).allowed, true);
    assert.equal(localRateLimit("a", rule, 0).allowed, false);
  });

  it("reports a shrinking retry-after as the window drains", () => {
    const rule = { limit: 1, windowSeconds: 100 };
    localRateLimit("k", rule, 0);
    assert.equal(localRateLimit("k", rule, 25_000).retryAfterSeconds, 75);
    assert.equal(localRateLimit("k", rule, 90_000).retryAfterSeconds, 10);
  });
});

describe("RATE_LIMITS", () => {
  it("keeps agent code login tight enough to matter", () => {
    // 8 chars over a 32-char alphabet is ~40 bits; the limit is what makes
    // guessing impractical, so a lax value here silently reopens the hole.
    assert.ok(RATE_LIMITS.agentCodeLogin.limit <= 20);
    assert.ok(RATE_LIMITS.agentCodeLogin.windowSeconds >= 300);
  });

  it("declares a positive limit and window for every bucket", () => {
    for (const [bucket, rule] of Object.entries(RATE_LIMITS)) {
      assert.ok(rule.limit > 0, bucket);
      assert.ok(rule.windowSeconds > 0, bucket);
    }
  });
});
