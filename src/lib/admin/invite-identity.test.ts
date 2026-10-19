import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  displayInviteLogin,
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
    assert.equal(result.phoneProvided, false);
    assert.equal(result.loginUsername, "ada@example.com");
  });

  it("accepts an 11-digit phone as the login username", () => {
    const result = resolveInviteIdentity({ email: "0813 374 7224", fullName: "Akin" });
    assert.equal("error" in result, false);
    if ("error" in result) return;
    assert.equal(result.phone, "08133747224");
    assert.equal(result.email, "08133747224@phone.ccc.local");
    assert.equal(result.phoneProvided, true);
    assert.equal(result.emailProvided, false);
    assert.equal(result.loginUsername, "08133747224");
  });

  it("prefers the phone field when both are set with a real email", () => {
    const result = resolveInviteIdentity({
      email: "ada@example.com",
      phone: "08133747224",
      fullName: "Ada",
    });
    assert.equal("error" in result, false);
    if ("error" in result) return;
    assert.equal(result.email, "ada@example.com");
    assert.equal(result.phone, "08133747224");
    assert.equal(result.emailProvided, true);
    assert.equal(result.phoneProvided, true);
    assert.equal(result.loginUsername, "ada@example.com");
  });

  it("allows blank email/phone when a full name is present", () => {
    const result = resolveInviteIdentity({ email: "  ", fullName: "Akin Anenih" });
    assert.equal("error" in result, false);
    if ("error" in result) return;
    assert.equal(result.emailProvided, false);
    assert.equal(result.phoneProvided, false);
    assert.equal(result.fullName, "Akin Anenih");
    assert.match(result.email, new RegExp(`^u[a-f0-9]{16}@${SYNTHETIC_INVITE_EMAIL_DOMAIN}$`));
    assert.equal(isSyntheticInviteEmail(result.email), true);
  });

  it("rejects blank identity without a name", () => {
    const result = resolveInviteIdentity({ email: "", fullName: "" });
    assert.deepEqual(result, { error: "Full name is required when email and phone are blank" });
  });

  it("rejects malformed email that is not a phone", () => {
    const result = resolveInviteIdentity({ email: "not-an-email", fullName: "Ada" });
    assert.deepEqual(result, {
      error: "Enter a valid email, an 11-digit Nigerian phone (e.g. 0813…), or leave blank",
    });
  });
});

describe("displayInviteLogin", () => {
  it("shows phone usernames and synthetic labels", () => {
    assert.equal(displayInviteLogin("08133747224@phone.ccc.local"), "08133747224");
    assert.equal(displayInviteLogin("ada@example.com"), "ada@example.com");
    assert.match(displayInviteLogin(`uabc@${SYNTHETIC_INVITE_EMAIL_DOMAIN}`), /No email/);
  });
});
