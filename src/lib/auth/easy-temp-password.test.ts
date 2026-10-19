import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { easyTempPassword } from "./easy-temp-password.ts";
import { formatInviteCredentials } from "./invite-credentials.ts";

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

describe("formatInviteCredentials", () => {
  it("formats username, password, and login URL for copy/paste", () => {
    assert.equal(
      formatInviteCredentials({
        username: "08133747224",
        password: "mango-river-47",
        loginUrl: "https://ccc.example/login",
      }),
      ["Username: 08133747224", "Temporary password: mango-river-47", "Login: https://ccc.example/login"].join(
        "\n"
      )
    );
  });
});
