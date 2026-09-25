import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { canAccessPitchDeck, isAkinAnenihName } from "./access.ts";

describe("isAkinAnenihName", () => {
  it("matches common spellings", () => {
    assert.equal(isAkinAnenihName("Akin Anenih"), true);
    assert.equal(isAkinAnenihName("AKIN ANENIH"), true);
    assert.equal(isAkinAnenihName("Akin  Anenih"), true);
    assert.equal(isAkinAnenihName("Anenih, Akin"), true);
  });

  it("rejects other people", () => {
    assert.equal(isAkinAnenihName("Hon Akhakon Anenih"), false);
    assert.equal(isAkinAnenihName("Jane Doe"), false);
    assert.equal(isAkinAnenihName(""), false);
    assert.equal(isAkinAnenihName(null), false);
  });
});

describe("canAccessPitchDeck", () => {
  const akin = {
    role: "super_administrator" as const,
    email: "akin@example.com",
    profile: { full_name: "Akin Anenih" } as { full_name: string },
  };

  it("allows Akin Anenih super administrator", () => {
    assert.equal(canAccessPitchDeck(akin), true);
  });

  it("denies other super administrators", () => {
    assert.equal(
      canAccessPitchDeck({
        ...akin,
        email: "other@example.com",
        profile: { full_name: "Other Admin" },
      }),
      false
    );
  });

  it("denies Akin when not super administrator", () => {
    assert.equal(
      canAccessPitchDeck({
        ...akin,
        role: "campaign_director" as never,
      }),
      false
    );
  });

  it("denies null user", () => {
    assert.equal(canAccessPitchDeck(null), false);
  });
});
