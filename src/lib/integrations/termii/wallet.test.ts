import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatTermiiWallet, termiiWalletFill, termiiWalletTone } from "./wallet.ts";
import { parseTermiiBalancePayload } from "./client.ts";

describe("parseTermiiBalancePayload", () => {
  it("reads Naira balance from Termii get-balance", () => {
    const result = parseTermiiBalancePayload(
      200,
      { user: "Campaign", balance: 12450.5, currency: "NGN" },
      "secret-key"
    );
    assert.equal(result.ok, true);
    assert.equal(result.balance, 12450.5);
    assert.equal(result.currency, "NGN");
  });

  it("treats HTTP 401 as a rejected API key", () => {
    const result = parseTermiiBalancePayload(401, { message: "Unauthorized" }, "secret-key");
    assert.equal(result.ok, false);
    assert.match(result.error ?? "", /API key/);
  });

  it("rejects a payload with no numeric balance", () => {
    const result = parseTermiiBalancePayload(200, { user: "Campaign" }, "secret-key");
    assert.equal(result.ok, false);
    assert.match(result.error ?? "", /wallet balance/);
  });
});

describe("Termii wallet dial", () => {
  it("formats Naira for HQ", () => {
    assert.match(formatTermiiWallet(12450.5), /12,450\.50/);
    assert.match(formatTermiiWallet(0), /₦|NGN/);
  });

  it("marks empty, low, and funded wallets", () => {
    assert.equal(termiiWalletTone(0), "empty");
    assert.equal(termiiWalletTone(250), "low");
    assert.equal(termiiWalletTone(5000), "ok");
  });

  it("fills the dial from zero to the cap", () => {
    assert.equal(termiiWalletFill(0), 0);
    assert.equal(termiiWalletFill(10_000, 20_000), 0.5);
    assert.equal(termiiWalletFill(50_000, 20_000), 1);
  });
});
