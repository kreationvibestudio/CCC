import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  clearStoredInviteCredentials,
  formatInviteCredentials,
  parseInviteCredentials,
  readStoredInviteCredentials,
  resolvePublicLoginUrl,
  writeStoredInviteCredentials,
} from "./invite-credentials.ts";

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

describe("parseInviteCredentials", () => {
  it("requires username and password", () => {
    assert.equal(parseInviteCredentials({ username: "", password: "x", loginUrl: "/login" }), null);
    assert.deepEqual(parseInviteCredentials({ username: "ada", password: "mango-river-47" }), {
      username: "ada",
      password: "mango-river-47",
      loginUrl: "/login",
    });
  });
});

describe("session storage helpers", () => {
  it("round-trips credentials so a remount can restore the panel", () => {
    const store = new Map<string, string>();
    const storage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => {
        store.set(k, v);
      },
      removeItem: (k: string) => {
        store.delete(k);
      },
    };
    writeStoredInviteCredentials(
      { username: "08133747224", password: "mango-river-47", loginUrl: "https://ccc.example/login" },
      storage
    );
    assert.deepEqual(readStoredInviteCredentials(storage), {
      username: "08133747224",
      password: "mango-river-47",
      loginUrl: "https://ccc.example/login",
    });
    clearStoredInviteCredentials(storage);
    assert.equal(readStoredInviteCredentials(storage), null);
  });
});

describe("resolvePublicLoginUrl", () => {
  it("prefers server URL then origin fallback", () => {
    assert.equal(resolvePublicLoginUrl("https://ccc.example/login", "http://localhost:3000"), "https://ccc.example/login");
    assert.equal(resolvePublicLoginUrl(null, "http://localhost:3000"), "http://localhost:3000/login");
    assert.equal(resolvePublicLoginUrl(undefined, null), "/login");
  });
});
