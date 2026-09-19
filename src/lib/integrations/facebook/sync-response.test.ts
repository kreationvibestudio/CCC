import assert from "node:assert/strict";
import { test } from "node:test";
import { facebookSyncFailureMessage } from "./sync-response.ts";

test("facebook sync toast never tells HQ to edit .env.local", () => {
  const expired = facebookSyncFailureMessage(
    { status: 401, statusText: "Unauthorized" },
    { error: "Unauthorized" }
  );
  assert.match(expired, /session expired/i);
  assert.doesNotMatch(expired, /\.env\.local/i);

  const server = facebookSyncFailureMessage(
    { status: 500, statusText: "Error" },
    {
      error:
        "Facebook page token is missing or expired. Paste a never-expiring page token under Page posts → Connect Facebook.",
    }
  );
  assert.match(server, /Connect Facebook/);
  assert.doesNotMatch(server, /\.env\.local/i);

  const html = facebookSyncFailureMessage({ status: 200, statusText: "OK" }, null);
  assert.match(html, /Connect Facebook/);
  assert.doesNotMatch(html, /\.env\.local/i);

  const timeout = facebookSyncFailureMessage({ status: 504, statusText: "Gateway Timeout" }, null);
  assert.match(timeout, /timed out/i);
  assert.match(timeout, /Sync again/i);
  assert.doesNotMatch(timeout, /\.env\.local/i);
});
