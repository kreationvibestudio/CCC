import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyTrainingTransition,
  countTraining,
  filterByTraining,
  isTrainingStatus,
  needsBriefing,
  trainingBadgeVariant,
  trainingStatusLabel,
} from "./training.ts";

describe("needsBriefing", () => {
  it("treats pending and in progress as still needing a briefing", () => {
    assert.equal(needsBriefing("pending"), true);
    assert.equal(needsBriefing("in_progress"), true);
    assert.equal(needsBriefing(null), true);
    assert.equal(needsBriefing(undefined), true);
  });

  it("excludes completed only", () => {
    assert.equal(needsBriefing("completed"), false);
  });
});

describe("countTraining", () => {
  it("counts pending as everyone who is not completed", () => {
    const counts = countTraining([
      { training_status: "pending" },
      { training_status: "in_progress" },
      { training_status: "completed" },
      { training_status: "completed" },
    ]);
    assert.deepEqual(counts, { total: 4, trained: 2, pending: 2 });
  });
});

describe("filterByTraining", () => {
  const rows = [
    { id: "1", training_status: "pending" },
    { id: "2", training_status: "in_progress" },
    { id: "3", training_status: "completed" },
  ];

  it("keeps in_progress on the needs-briefing list", () => {
    assert.deepEqual(
      filterByTraining(rows, "needs_briefing").map((r) => r.id),
      ["1", "2"]
    );
  });

  it("lists only completed as trained", () => {
    assert.deepEqual(
      filterByTraining(rows, "trained").map((r) => r.id),
      ["3"]
    );
  });

  it("returns everyone for all", () => {
    assert.equal(filterByTraining(rows, "all").length, 3);
  });
});

describe("applyTrainingTransition", () => {
  const now = new Date("2026-09-10T12:00:00.000Z");

  it("sets trained_at when marking completed", () => {
    assert.deepEqual(applyTrainingTransition({ next: "completed", now }), {
      training_status: "completed",
      trained_at: "2026-09-10T12:00:00.000Z",
    });
  });

  it("keeps an existing trained_at if they were already marked trained", () => {
    assert.deepEqual(
      applyTrainingTransition({
        next: "completed",
        existingTrainedAt: "2026-08-01T08:00:00.000Z",
        now,
      }),
      {
        training_status: "completed",
        trained_at: "2026-08-01T08:00:00.000Z",
      }
    );
  });

  it("clears trained_at when moving back to in progress or pending", () => {
    assert.deepEqual(
      applyTrainingTransition({
        next: "in_progress",
        existingTrainedAt: "2026-08-01T08:00:00.000Z",
        now,
      }),
      { training_status: "in_progress", trained_at: null }
    );
    assert.deepEqual(
      applyTrainingTransition({ next: "pending", now }),
      { training_status: "pending", trained_at: null }
    );
  });

  it("persists trimmed notes when provided", () => {
    const patch = applyTrainingTransition({
      next: "completed",
      notes: "  Briefed at ward hall  ",
      now,
    });
    assert.equal(patch.training_notes, "Briefed at ward hall");
  });

  it("does not include notes unless the caller passed them", () => {
    const patch = applyTrainingTransition({ next: "in_progress", now });
    assert.equal("training_notes" in patch, false);
  });
});

describe("training labels", () => {
  it("maps workflow flags to HQ copy and badge colors", () => {
    assert.equal(trainingStatusLabel("pending"), "Pending");
    assert.equal(trainingStatusLabel("in_progress"), "In progress");
    assert.equal(trainingStatusLabel("completed"), "Trained");
    assert.equal(trainingBadgeVariant("pending"), "warning");
    assert.equal(trainingBadgeVariant("in_progress"), "info");
    assert.equal(trainingBadgeVariant("completed"), "success");
  });

  it("accepts only the three workflow flags", () => {
    assert.equal(isTrainingStatus("pending"), true);
    assert.equal(isTrainingStatus("done"), false);
    assert.equal(isTrainingStatus(""), false);
  });
});
