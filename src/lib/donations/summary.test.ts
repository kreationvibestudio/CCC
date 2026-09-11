import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { fundraisingProgress, paymentMethodLabel, summarizeDonations } from "./summary.ts";

describe("summarizeDonations", () => {
  it("totals gifts, unique donors, and average", () => {
    const summary = summarizeDonations([
      { amount: 5000, contact_id: "a" },
      { amount: "2500", contact_id: "a" },
      { amount: 1000, contact_id: "b" },
      { amount: 750, contact_id: null },
    ]);
    assert.equal(summary.raised, 9250);
    assert.equal(summary.giftCount, 4);
    assert.equal(summary.uniqueDonors, 3);
    assert.equal(summary.average, 9250 / 4);
  });

  it("treats empty ledgers as zeros", () => {
    assert.deepEqual(summarizeDonations([]), {
      raised: 0,
      giftCount: 0,
      uniqueDonors: 0,
      average: 0,
    });
  });
});

describe("fundraisingProgress", () => {
  it("caps at 100 and ignores a missing goal", () => {
    assert.equal(fundraisingProgress(40_000, 100_000), 40);
    assert.equal(fundraisingProgress(150_000, 100_000), 100);
    assert.equal(fundraisingProgress(10, 0), 0);
  });
});

describe("paymentMethodLabel", () => {
  it("labels Paystack channels and offline methods", () => {
    assert.equal(paymentMethodLabel("paystack"), "Paystack");
    assert.equal(paymentMethodLabel("paystack_card"), "Paystack (card)");
    assert.equal(paymentMethodLabel("bank_transfer"), "bank transfer");
    assert.equal(paymentMethodLabel(null), "Unknown");
  });
});
