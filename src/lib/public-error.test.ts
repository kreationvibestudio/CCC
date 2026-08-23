import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { toErrorMessage } from "./public-error.ts";

describe("toErrorMessage", () => {
  it("keeps real strings and Error messages", () => {
    assert.equal(toErrorMessage("Valid email is required"), "Valid email is required");
    assert.equal(toErrorMessage(new Error("Could not create login")), "Could not create login");
  });

  it("does not show empty objects in toasts", () => {
    assert.equal(toErrorMessage({}), "Something went wrong");
    assert.equal(toErrorMessage("{}"), "Something went wrong");
    assert.equal(toErrorMessage({ message: "Could not find the table" }), "Could not find the table");
    class AuthShapedError extends Error {}
    const auth = new AuthShapedError("A user with this email address has already been registered");
    assert.equal(JSON.stringify(auth), "{}");
    assert.equal(toErrorMessage({ msg: "Database error creating new user" }), "Database error creating new user");
    assert.equal(toErrorMessage(auth), "A user with this email address has already been registered");
  });
});
