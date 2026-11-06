import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { memberDisplayName, validateMemberRegistration } from "./validate.ts";
import { UNIT_MEMBERS_TABLE_MIGRATION_SQL } from "./schema.ts";

describe("unit member registration validation", () => {
  it("requires identity and geography fields", () => {
    const missing = validateMemberRegistration({
      firstName: "",
      lastName: "Okoro",
      phone: "08031112222",
      votersCardNumber: "90F5B9",
      membershipCardNumber: "NDC-100",
      lga: "Esan North-East",
      ward: "Uromi I",
      pollingUnitId: "pu-1",
    });
    assert.equal("error" in missing, true);

    const ok = validateMemberRegistration({
      firstName: "Ada",
      lastName: "Okoro",
      phone: "0803 111 2222",
      votersCardNumber: "90f5b9",
      membershipCardNumber: "ndc-100",
      state: "Edo",
      lga: "Esan North-East",
      ward: "Uromi I",
      pollingUnitId: "pu-1",
    });
    assert.equal("value" in ok, true);
    if ("value" in ok) {
      assert.equal(ok.value.phone, "08031112222");
      assert.equal(ok.value.votersCardNumber, "90F5B9");
      assert.equal(ok.value.membershipCardNumber, "NDC-100");
    }
  });

  it("builds display names and exposes pasteable SQL", () => {
    assert.equal(memberDisplayName("Ada", "Okoro"), "Ada Okoro");
    assert.match(UNIT_MEMBERS_TABLE_MIGRATION_SQL, /CREATE TABLE IF NOT EXISTS unit_members/);
    assert.match(UNIT_MEMBERS_TABLE_MIGRATION_SQL, /membership_card_number/);
  });
});
