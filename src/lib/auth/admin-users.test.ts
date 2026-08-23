import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  authUserIdFromBody,
  parseGoTrueError,
  isAlreadyRegistered,
  isTriggerCreateError,
  hqCreateUserBodies,
} from "./admin-users.ts";

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
    assert.equal(isTriggerCreateError(500, "Database error creating new user (500)"), true);
    assert.equal(isTriggerCreateError(401, "Invalid API key"), false);
  });
});

describe("hqCreateUserBodies", () => {
  it("retries without role so a bad user_role cast cannot block HQ invites", () => {
    const bodies = hqCreateUserBodies({
      email: "fa@example.com",
      password: "Passw0rd!aaa",
      fullName: "Field Agent",
      tenantId: "a0000000-0000-0000-0000-000000000001",
      role: "polling_agent",
    });
    assert.equal(bodies.length, 3);
    assert.equal(bodies[0].user_metadata.role, "polling_agent");
    assert.equal("role" in bodies[1].user_metadata, false);
    assert.equal("tenant_id" in bodies[2].user_metadata, false);
  });
});
