import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isMissingColumnError, toTrainingVolunteer } from "./training-volunteers.ts";

describe("toTrainingVolunteer", () => {
  it("keeps a volunteer when LMS columns are absent", () => {
    const person = toTrainingVolunteer({
      id: "a0000000-0000-0000-0000-000000000010",
      full_name: "Ada Okonkwo",
      phone: "08031234567",
      lga: "Esan North East",
      ward: "Ward 1",
      training_status: "pending",
    });
    assert.equal(person?.full_name, "Ada Okonkwo");
    assert.equal(person?.training_status, "pending");
    assert.equal(person?.deployment_ready, false);
    assert.equal(person?.training_code, null);
    assert.equal(person?.trained_at, null);
    assert.deepEqual(person?.support_roles, []);
  });

  it("reads LMS fields when they are present", () => {
    const person = toTrainingVolunteer({
      id: "a0000000-0000-0000-0000-000000000011",
      full_name: "Bola Eze",
      phone: "08035551212",
      email: "bola@example.com",
      support_roles: ["field_canvassing"],
      training_status: "in_progress",
      deployment_ready: true,
      training_code: "ABCD-EFGH",
      trained_at: "2026-09-11T08:00:00.000Z",
    });
    assert.equal(person?.email, "bola@example.com");
    assert.deepEqual(person?.support_roles, ["field_canvassing"]);
    assert.equal(person?.deployment_ready, true);
    assert.equal(person?.training_code, "ABCD-EFGH");
  });

  it("drops rows without an id or name", () => {
    assert.equal(toTrainingVolunteer({ full_name: "No Id" }), null);
    assert.equal(toTrainingVolunteer({ id: "x" }), null);
  });
});

describe("isMissingColumnError", () => {
  it("detects PostgREST missing-column payloads", () => {
    assert.equal(isMissingColumnError("column volunteers.trained_at does not exist"), true);
    assert.equal(isMissingColumnError('Could not find the "trained_at" column of "volunteers" in the schema cache'), true);
    assert.equal(isMissingColumnError("JWT expired"), false);
  });
});
