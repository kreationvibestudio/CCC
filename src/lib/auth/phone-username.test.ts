import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  authEmailToPhone,
  isPhoneAuthEmail,
  normalizeNgMobile11,
  phoneToAuthEmail,
  resolveLoginAuthEmail,
} from "./phone-username.ts";

describe("normalizeNgMobile11", () => {
  it("accepts local 11-digit mobiles", () => {
    assert.equal(normalizeNgMobile11("08133747224"), "08133747224");
    assert.equal(normalizeNgMobile11("0813 374 7224"), "08133747224");
  });

  it("normalizes +234 / 234 forms", () => {
    assert.equal(normalizeNgMobile11("+2348133747224"), "08133747224");
    assert.equal(normalizeNgMobile11("2348133747224"), "08133747224");
  });

  it("rejects invalid lengths", () => {
    assert.equal(normalizeNgMobile11("8133747224"), "08133747224"); // 10-digit → pad
    assert.equal(normalizeNgMobile11("12345"), null);
    assert.equal(normalizeNgMobile11("ada@example.com"), null);
  });
});

describe("phone auth email mapping", () => {
  it("round-trips phone ↔ auth email", () => {
    const email = phoneToAuthEmail("08133747224");
    assert.equal(email, "08133747224@phone.ccc.local");
    assert.equal(authEmailToPhone(email), "08133747224");
    assert.equal(isPhoneAuthEmail(email), true);
    assert.equal(isPhoneAuthEmail("ada@example.com"), false);
  });
});

describe("resolveLoginAuthEmail", () => {
  it("maps phone usernames to auth emails and leaves real emails alone", () => {
    assert.equal(resolveLoginAuthEmail("08133747224"), "08133747224@phone.ccc.local");
    assert.equal(resolveLoginAuthEmail(" Ada@Example.COM "), "ada@example.com");
  });
});
