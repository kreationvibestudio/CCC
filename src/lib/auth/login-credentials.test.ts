import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readLoginCredentials } from "./login-credentials.ts";

function form(values: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

describe("readLoginCredentials", () => {
  it("rejects empty fields", () => {
    assert.deepEqual(readLoginCredentials(form({})), { error: "Email and password are required" });
    assert.deepEqual(readLoginCredentials(form({ email: "  ", password: "secret" })), {
      error: "Email and password are required",
    });
    assert.deepEqual(
      readLoginCredentials(form({ email: "admin@demo.campaign.ng", password: "" })),
      { error: "Email and password are required" }
    );
  });

  it("reads trimmed email and password from the form, including autofilled values", () => {
    assert.deepEqual(
      readLoginCredentials(form({ email: "  admin@demo.campaign.ng  ", password: "DemoPassword123!" })),
      {
        email: "admin@demo.campaign.ng",
        password: "DemoPassword123!",
      }
    );
  });
});
