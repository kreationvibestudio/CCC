import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isSyntheticInviteEmail,
  resolveInviteIdentity,
  SYNTHETIC_INVITE_EMAIL_DOMAIN,
} from "./invite-identity.ts";

describe("resolveInviteIdentity", () => {
  it("accepts a real email and fills name from the local part when needed", () => {
    const result = resolveInviteIdentity({ email: " Ada@Example.COM ", fullName: "" });
    assert.equal("error" in result, false);
    if ("error" in result) return;
    assert.equal(result.email, "ada@example.com");
    assert.equal(result.fullName, "ada");
    assert.equal(result.emailProvided, true);
  });

  it("allows blank email when a full name is present", () => {
    const result = resolveInviteIdentity({ email: "  ", fullName: "Akin Anenih" });
    assert.equal("error" in result, false);
    if ("error" in result) return;
    assert.equal(result.emailProvided, false);
    assert.equal(result.fullName, "Akin Anenih");
    assert.match(result.email, new RegExp(`^u[a-f0-9]{16}@${SYNTHETIC_INVITE_EMAIL_DOMAIN}$`));
    assert.equal(isSyntheticInviteEmail(result.email), true);
  });

  it("rejects blank email without a name", () => {
    const result = resolveInviteIdentity({ email: "", fullName: "" });
    assert.deepEqual(result, { error: "Full name is required when email is blank" });
  });

  it("rejects malformed email", () => {
    const result = resolveInviteIdentity({ email: "not-an-email", fullName: "Ada" });
    assert.deepEqual(result, { error: "Enter a valid email, or leave it blank" });
  });
});

describe("isSyntheticInviteEmail", () => {
  it("detects private login ids", () => {
    assert.equal(isSyntheticInviteEmail(`uabc@${SYNTHETIC_INVITE_EMAIL_DOMAIN}`), true);
    assert.equal(isSyntheticInviteEmail("ada@example.com"), false);
    assert.equal(isSyntheticInviteEmail(null), false);
  });
});
