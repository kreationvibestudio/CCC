import assert from "node:assert/strict";
import { test } from "node:test";
import { canTransition, statusPatch, transitionError } from "./status.ts";

test("draft can be approved or killed, not posted", () => {
  assert.equal(canTransition("draft", "approved"), true);
  assert.equal(canTransition("draft", "killed"), true);
  assert.equal(canTransition("draft", "posted"), false);
  assert.match(transitionError("draft", "posted") ?? "", /Cannot move/);
});

test("approved can schedule, revert, post, or kill", () => {
  assert.equal(canTransition("approved", "scheduled"), true);
  assert.equal(canTransition("approved", "draft"), true);
  assert.equal(canTransition("approved", "posted"), true);
  assert.equal(canTransition("approved", "killed"), true);
});

test("scheduled can post, return to approved, or die", () => {
  assert.equal(canTransition("scheduled", "posted"), true);
  assert.equal(canTransition("scheduled", "approved"), true);
  assert.equal(canTransition("scheduled", "killed"), true);
  assert.equal(canTransition("scheduled", "draft"), false);
});

test("posted is terminal and killed can return to draft", () => {
  assert.equal(canTransition("posted", "draft"), false);
  assert.equal(canTransition("killed", "draft"), true);
  assert.equal(canTransition("killed", "posted"), false);
});

test("scheduling requires a real timestamp", () => {
  const missing = statusPatch("approved", "scheduled");
  assert.equal(missing.ok, false);
  if (!missing.ok) assert.match(missing.error, /schedule time/i);

  const bad = statusPatch("approved", "scheduled", { scheduledAt: "not-a-date" });
  assert.equal(bad.ok, false);

  const ok = statusPatch("approved", "scheduled", {
    scheduledAt: "2026-09-14T09:00:00.000Z",
    now: new Date("2026-09-13T12:00:00.000Z"),
  });
  assert.equal(ok.ok, true);
  if (ok.ok) {
    assert.equal(ok.patch.status, "scheduled");
    assert.equal(ok.patch.scheduled_at, "2026-09-14T09:00:00.000Z");
  }
});

test("marking posted stamps posted_at", () => {
  const now = new Date("2026-09-13T07:00:00.000Z");
  const result = statusPatch("approved", "posted", { now });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.patch.status, "posted");
    assert.equal(result.patch.posted_at, now.toISOString());
  }
});
