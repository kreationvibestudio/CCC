import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CCC_PRODUCTION_ORIGIN, paystackWebhookUrls } from "./webhooks.ts";

describe("paystackWebhookUrls", () => {
  it("uses the production host when the app URL is local", () => {
    assert.deepEqual(paystackWebhookUrls("http://localhost:3000"), {
      webhookUrl: `${CCC_PRODUCTION_ORIGIN}/api/donations/webhook`,
      webhookAliasUrl: `${CCC_PRODUCTION_ORIGIN}/api/paystack/webhook`,
    });
  });

  it("keeps a public app URL so a workspace webhook matches that host", () => {
    assert.deepEqual(paystackWebhookUrls("https://ccc-three-kappa.vercel.app"), {
      webhookUrl: "https://ccc-three-kappa.vercel.app/api/donations/webhook",
      webhookAliasUrl: "https://ccc-three-kappa.vercel.app/api/paystack/webhook",
    });
  });
});
