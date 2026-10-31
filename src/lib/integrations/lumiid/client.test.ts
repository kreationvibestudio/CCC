import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  lumiIdConfigured,
  verifyNinWithLumiId,
  LUMIID_TEST_PERSONA,
} from "./client.ts";

describe("lumiid client", () => {
  it("rejects masked placeholder secrets", () => {
    assert.equal(lumiIdConfigured("sk_live_4c33e008••••••••••••••••"), false);
    assert.equal(lumiIdConfigured("sk_live_4c33e008abcdef"), true);
  });

  it("demo-verifies the Adaeze Okonkwo sandbox persona", async () => {
    const prevKey = process.env.LUMIID_SECRET_KEY;
    const prevDemo = process.env.LUMIID_DEMO_MODE;
    delete process.env.LUMIID_SECRET_KEY;
    process.env.LUMIID_DEMO_MODE = "true";
    try {
      const ok = await verifyNinWithLumiId({
        nin: LUMIID_TEST_PERSONA.nin,
        firstname: LUMIID_TEST_PERSONA.firstname,
        lastname: LUMIID_TEST_PERSONA.lastname,
      });
      assert.equal(ok.ok, true);
      assert.equal(ok.demo, true);
      assert.equal(ok.data?.firstname, "Adaeze");

      const bad = await verifyNinWithLumiId({
        nin: "12345678901",
        firstname: "Jane",
        lastname: "Smith",
      });
      assert.equal(bad.ok, false);
    } finally {
      if (prevKey === undefined) delete process.env.LUMIID_SECRET_KEY;
      else process.env.LUMIID_SECRET_KEY = prevKey;
      if (prevDemo === undefined) delete process.env.LUMIID_DEMO_MODE;
      else process.env.LUMIID_DEMO_MODE = prevDemo;
    }
  });
});
