import assert from "node:assert/strict";
import { test } from "node:test";
import { wantsJsonUnauthorized } from "./json-unauthorized.ts";

test("unauthenticated API paths ask for JSON, not an HTML login page", () => {
  assert.equal(wantsJsonUnauthorized("/api/sync/facebook"), true);
  assert.equal(wantsJsonUnauthorized("/api/polling-units/sync-inec"), true);
  assert.equal(wantsJsonUnauthorized("/media"), false);
  assert.equal(wantsJsonUnauthorized("/login"), false);
});
