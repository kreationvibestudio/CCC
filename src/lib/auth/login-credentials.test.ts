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
    assert.deepEqual(readLoginCredentials(form({})), {
      error: "Email or phone and password are required",
    });
    assert.deepEqual(readLoginCredentials(form({ email: "  ", password: "secret" })), {
      error: "Email or phone and password are required",
    });
    assert.deepEqual(
      readLoginCredentials(form({ email: "admin@demo.campaign.ng", password: "" })),
      { error: "Email or phone and password are required" }
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

  it("maps an 11-digit phone username to the Auth email", () => {
    assert.deepEqual(
      readLoginCredentials(form({ email: "0813 374 7224", password: "Passw0rd!" })),
      {
        email: "08133747224@phone.ccc.local",
        password: "Passw0rd!",
      }
    );
  });
});
