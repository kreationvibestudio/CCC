import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { verifyNinIdentity } from "./client.ts";
import {
  normalizeNin,
  splitPersonName,
  toVerifyMeDob,
  VERIFYME_TEST_PERSONA,
} from "./helpers.ts";

describe("verifyme client helpers", () => {
  it("normalizes 11-digit NINs", () => {
    assert.equal(normalizeNin("1000-0000-001"), "10000000001");
    assert.equal(normalizeNin("123"), null);
  });

  it("formats DOB for VerifyMe", () => {
    assert.equal(toVerifyMeDob("1944-04-04"), "04-04-1944");
    assert.equal(toVerifyMeDob("04/04/1944"), "04-04-1944");
    assert.equal(toVerifyMeDob("bad"), null);
  });

  it("splits full names", () => {
    assert.deepEqual(splitPersonName("John Doe"), { firstname: "John", lastname: "Doe" });
    assert.deepEqual(splitPersonName("Ada"), { firstname: "Ada", lastname: "Ada" });
  });

  it("demo-verifies the John Doe test persona when no API key", async () => {
    const prevKey = process.env.VERIFYME_API_KEY;
    const prevDemo = process.env.VERIFYME_DEMO_MODE;
    delete process.env.VERIFYME_API_KEY;
    process.env.VERIFYME_DEMO_MODE = "true";
    try {
      const ok = await verifyNinIdentity({
        nin: VERIFYME_TEST_PERSONA.nin,
        firstname: VERIFYME_TEST_PERSONA.firstname,
        lastname: VERIFYME_TEST_PERSONA.lastname,
        dob: "1944-04-04",
      });
      assert.equal(ok.ok, true);
      assert.equal(ok.demo, true);
      assert.equal(ok.data?.firstname, "John");

      const bad = await verifyNinIdentity({
        nin: "12345678901",
        firstname: "Jane",
        lastname: "Smith",
        dob: "1990-01-01",
      });
      assert.equal(bad.ok, false);
    } finally {
      if (prevKey === undefined) delete process.env.VERIFYME_API_KEY;
      else process.env.VERIFYME_API_KEY = prevKey;
      if (prevDemo === undefined) delete process.env.VERIFYME_DEMO_MODE;
      else process.env.VERIFYME_DEMO_MODE = prevDemo;
    }
  });
});
