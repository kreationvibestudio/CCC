import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createSyncDeadline,
  facebookSyncProfile,
  partialCommentsWarning,
} from "./sync-budget.ts";

describe("facebookSyncProfile", () => {
  it("keeps interactive sync shorter than cron", () => {
    const interactive = facebookSyncProfile("interactive");
    const cron = facebookSyncProfile("cron");
    assert.ok(interactive.maxPosts < cron.maxPosts);
    assert.ok(interactive.budgetMs < cron.budgetMs);
    assert.equal(interactive.enrichAuthorsInline, false);
    assert.equal(cron.enrichAuthorsInline, true);
  });
});

describe("createSyncDeadline", () => {
  it("expires after the budget", () => {
    const deadline = createSyncDeadline(5_000, Date.now() - 6_000);
    assert.equal(deadline.expired(), true);
    assert.equal(deadline.hasMs(1), false);
    assert.ok(deadline.remainingMs() < 0);
  });

  it("has time when budget remains", () => {
    const deadline = createSyncDeadline(60_000, Date.now());
    assert.equal(deadline.expired(), false);
    assert.equal(deadline.hasMs(1_000), true);
  });
});

describe("partialCommentsWarning", () => {
  it("mentions remaining posts and retry", () => {
    assert.match(partialCommentsWarning(3), /3 older posts/);
    assert.match(partialCommentsWarning(0), /time out/i);
  });
});
