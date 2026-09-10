import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveAppHost, volunteerLearnLoginUrl } from "./learn-url.ts";

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
});
