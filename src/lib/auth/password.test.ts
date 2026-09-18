import assert from "node:assert/strict";
import { test } from "node:test";
import {
  mustChangePassword,
  passwordChangeAllowedPath,
  validateNewPassword,
} from "./password.ts";

test("mustChangePassword reads service-role app_metadata only", () => {
  assert.equal(mustChangePassword(null), false);
  assert.equal(mustChangePassword({}), false);
  assert.equal(mustChangePassword({ app_metadata: { hq_invite: true } }), false);
  assert.equal(mustChangePassword({ app_metadata: { must_change_password: true } }), true);
  assert.equal(mustChangePassword({ app_metadata: { must_change_password: false } }), false);
});

test("validateNewPassword requires current, match, and a different new password", () => {
  assert.match(validateNewPassword({ current: "", next: "Newpass1!", confirm: "Newpass1!" }) ?? "", /current password/i);
  assert.match(validateNewPassword({ current: "TempAa1!", next: "short", confirm: "short" }) ?? "", /8/);
  assert.match(
    validateNewPassword({ current: "TempAa1!", next: "Newpass1!", confirm: "Other1!!" }) ?? "",
    /match/i
  );
  assert.match(
    validateNewPassword({ current: "TempAa1!", next: "TempAa1!", confirm: "TempAa1!" }) ?? "",
    /different from the current/i
  );
  assert.equal(
    validateNewPassword({ current: "TempAa1!", next: "Permanent9!", confirm: "Permanent9!" }),
    null
  );
});

test("first-login gate still allows password change, forgot-password, and agent codes", () => {
  assert.equal(passwordChangeAllowedPath("/change-password"), true);
  assert.equal(passwordChangeAllowedPath("/forgot-password"), true);
  assert.equal(passwordChangeAllowedPath("/api/agent/code-login"), true);
  assert.equal(passwordChangeAllowedPath("/agent/login"), true);
  assert.equal(passwordChangeAllowedPath("/login"), false);
  assert.equal(passwordChangeAllowedPath("/dashboard"), false);
  assert.equal(passwordChangeAllowedPath("/media"), false);
  assert.equal(passwordChangeAllowedPath("/settings"), false);
});
