import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { qoreIdConfigured, verifyNinWithQoreId, QOREID_TEST_PERSONAS } from "./client.ts";

describe("qoreid client", () => {
  it("reports configured only when both client id and secret exist", () => {
    assert.equal(qoreIdConfigured("abc", "secret"), true);
    assert.equal(qoreIdConfigured("abc", ""), false);
    assert.equal(qoreIdConfigured("", "secret"), false);
  });

  it("demo-verifies the Bunch Dillon persona when demo mode is on", async () => {
    const prevId = process.env.QOREID_CLIENT_ID;
    const prevSecret = process.env.QOREID_SECRET_KEY;
    const prevDemo = process.env.QOREID_DEMO_MODE;
    delete process.env.QOREID_CLIENT_ID;
    delete process.env.QOREID_SECRET_KEY;
    process.env.QOREID_DEMO_MODE = "true";
    try {
      const persona = QOREID_TEST_PERSONAS[0];
      const ok = await verifyNinWithQoreId({
        nin: persona.nin,
        firstname: persona.firstname,
        lastname: persona.lastname,
      });
      assert.equal(ok.ok, true);
      assert.equal(ok.demo, true);
      assert.equal(ok.data?.firstname, "Bunch");

      const bad = await verifyNinWithQoreId({
        nin: "12345678901",
        firstname: "Jane",
        lastname: "Smith",
      });
      assert.equal(bad.ok, false);
    } finally {
      if (prevId === undefined) delete process.env.QOREID_CLIENT_ID;
      else process.env.QOREID_CLIENT_ID = prevId;
      if (prevSecret === undefined) delete process.env.QOREID_SECRET_KEY;
      else process.env.QOREID_SECRET_KEY = prevSecret;
      if (prevDemo === undefined) delete process.env.QOREID_DEMO_MODE;
      else process.env.QOREID_DEMO_MODE = prevDemo;
    }
  });
});
