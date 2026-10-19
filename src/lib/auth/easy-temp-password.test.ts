import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { easyTempPassword } from "./easy-temp-password.ts";

describe("easyTempPassword", () => {
  it("returns word-word-digits that are easy to read aloud", () => {
    for (let i = 0; i < 40; i += 1) {
      const password = easyTempPassword();
      assert.match(password, /^[a-z]+-[a-z]+-\d{2}$/);
      assert.ok(password.length >= 8);
      assert.doesNotMatch(password, /[A-Z!@#$%^&*()]/);
      const digits = password.split("-")[2]!;
      assert.doesNotMatch(digits, /[01]/);
    }
  });
});
