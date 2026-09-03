import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildDecisionCalls, daysUntil, pct } from "./decisions.ts";

describe("analytics decision calls", () => {
  it("raises critical calls for misinfo and uncovered high-risk PUs", () => {
    const calls = buildDecisionCalls({
      daysToElection: 60,
      pendingComments: 2,
      misinfoOpen: 3,
      flaggedComments: 0,
      sentimentScore: 55,
      negativeShare: 20,
      recentNegativeDelta: 0,
      agentCoveragePct: 80,
      uncoveredHighRiskPus: 2,
      uncoveredHighVoterPus: 0,
      volunteersTrainedPct: 70,
      undecidedContacts: 1,
      totalContacts: 10,
      upcomingEvents: 2,
      hotIssue: null,
      pressureWard: null,
    });
    assert.equal(calls[0]?.severity, "critical");
    assert.ok(calls.some((c) => c.id === "misinfo"));
    assert.ok(calls.some((c) => c.id === "high-risk-coverage"));
  });

  it("returns hold-course when signals are calm", () => {
    const calls = buildDecisionCalls({
      daysToElection: 120,
      pendingComments: 0,
      misinfoOpen: 0,
      flaggedComments: 0,
      sentimentScore: 70,
      negativeShare: 10,
      recentNegativeDelta: -2,
      agentCoveragePct: 90,
      uncoveredHighRiskPus: 0,
      uncoveredHighVoterPus: 0,
      volunteersTrainedPct: 80,
      undecidedContacts: 2,
      totalContacts: 20,
      upcomingEvents: 3,
      hotIssue: { topic: "roads", negative: 0, total: 1 },
      pressureWard: null,
    });
    assert.equal(calls.length, 1);
    assert.equal(calls[0]?.id, "hold-course");
  });

  it("computes pct and daysUntil helpers", () => {
    assert.equal(pct(1, 4), 25);
    assert.equal(pct(0, 0), 0);
    const d = daysUntil(new Date(Date.now() + 3 * 86400000).toISOString(), new Date());
    assert.ok(d === 3 || d === 4);
  });
});
