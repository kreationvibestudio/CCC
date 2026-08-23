import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { authUserIdFromBody, parseGoTrueError, isAlreadyRegistered } from "./admin-users.ts";

describe("authUserIdFromBody", () => {
  it("reads GoTrue admin createUser payloads", () => {
    assert.equal(authUserIdFromBody({ id: "11111111-1111-1111-1111-111111111111" }), "11111111-1111-1111-1111-111111111111");
    assert.equal(
      authUserIdFromBody({ user: { id: "22222222-2222-2222-2222-222222222222" } }),
      "22222222-2222-2222-2222-222222222222",
    );
    assert.equal(authUserIdFromBody({}), null);
    assert.equal(authUserIdFromBody({ users: [] }), null);
  });
});

describe("parseGoTrueError", () => {
  it("prefers msg from GoTrue and keeps the HTTP status", () => {
    assert.equal(
      parseGoTrueError(422, JSON.stringify({ msg: "A user with this email address has already been registered", code: "email_exists" })),
      "A user with this email address has already been registered (422)",
    );
    assert.equal(parseGoTrueError(500, "Database error creating new user"), "Database error creating new user (500)");
    assert.equal(parseGoTrueError(500, "{}"), "Auth admin HTTP 500 (500)");
    assert.equal(isAlreadyRegistered(422, "email_exists (422)"), true);
    assert.equal(isAlreadyRegistered(500, "Database error creating new user (500)"), false);
  });
});
