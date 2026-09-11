import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveAppHost, resolveRequestHost, volunteerLearnLoginUrl } from "./learn-url.ts";

describe("volunteerLearnLoginUrl", () => {
  it("builds the Learn login path from the app URL and workspace slug", () => {
    assert.equal(
      volunteerLearnLoginUrl("progressive-alliance-2027", "https://ccc-three-kappa.vercel.app/"),
      "https://ccc-three-kappa.vercel.app/learn/progressive-alliance-2027/login"
    );
  });

  it("returns empty when the host or slug is missing", () => {
    assert.equal(volunteerLearnLoginUrl("", "https://ccc.example"), "");
    assert.equal(volunteerLearnLoginUrl("campaign", ""), "");
  });
});

describe("resolveAppHost", () => {
  it("prefers NEXT_PUBLIC_APP_URL and falls back to VERCEL_URL", () => {
    assert.equal(resolveAppHost("https://ccc.example/"), "https://ccc.example");
    const prevApp = process.env.NEXT_PUBLIC_APP_URL;
    const prevVercel = process.env.VERCEL_URL;
    delete process.env.NEXT_PUBLIC_APP_URL;
    process.env.VERCEL_URL = "ccc-three-kappa.vercel.app";
    try {
      assert.equal(resolveAppHost(""), "https://ccc-three-kappa.vercel.app");
    } finally {
      if (prevApp === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
      else process.env.NEXT_PUBLIC_APP_URL = prevApp;
      if (prevVercel === undefined) delete process.env.VERCEL_URL;
      else process.env.VERCEL_URL = prevVercel;
    }
  });

  it("falls back to the request host when env URLs are missing", () => {
    const prevApp = process.env.NEXT_PUBLIC_APP_URL;
    const prevVercel = process.env.VERCEL_URL;
    delete process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.VERCEL_URL;
    try {
      assert.equal(
        resolveAppHost("", resolveRequestHost({ forwardedProto: "https", host: "ccc-three-kappa.vercel.app" })),
        "https://ccc-three-kappa.vercel.app"
      );
    } finally {
      if (prevApp === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
      else process.env.NEXT_PUBLIC_APP_URL = prevApp;
      if (prevVercel === undefined) delete process.env.VERCEL_URL;
      else process.env.VERCEL_URL = prevVercel;
    }
  });
});

describe("resolveRequestHost", () => {
  it("builds an origin from forwarded headers", () => {
    assert.equal(
      resolveRequestHost({
        forwardedProto: "https",
        forwardedHost: "ccc-three-kappa.vercel.app",
        host: "localhost:3000",
      }),
      "https://ccc-three-kappa.vercel.app"
    );
    assert.equal(resolveRequestHost({ host: "localhost:3011", forwardedProto: "http" }), "http://localhost:3011");
    assert.equal(resolveRequestHost({}), "");
  });
});
