/** Pure election-decision scoring — no I/O. */

export type CallSeverity = "critical" | "high" | "watch";

export type DecisionCall = {
  id: string;
  severity: CallSeverity;
  title: string;
  reason: string;
  action: string;
  href: string;
};

export type DecisionInput = {
  daysToElection: number | null;
  pendingComments: number;
  misinfoOpen: number;
  flaggedComments: number;
  sentimentScore: number;
  negativeShare: number;
  recentNegativeDelta: number;
  agentCoveragePct: number;
  uncoveredHighRiskPus: number;
  uncoveredHighVoterPus: number;
  volunteersTrainedPct: number;
  undecidedContacts: number;
  totalContacts: number;
  upcomingEvents: number;
  hotIssue?: { topic: string; negative: number; total: number } | null;
  pressureWard?: { ward: string; negativePct: number; negative: number } | null;
};

const SEVERITY_RANK: Record<CallSeverity, number> = { critical: 0, high: 1, watch: 2 };

export function buildDecisionCalls(input: DecisionInput): DecisionCall[] {
  const calls: DecisionCall[] = [];

  if (input.misinfoOpen > 0) {
    calls.push({
      id: "misinfo",
      severity: "critical",
      title: "Kill misinformation early",
      reason: `${input.misinfoOpen} open misinformation flag${input.misinfoOpen === 1 ? "" : "s"} still need a reply or fact-check.`,
      action: "Assign media/rapid-response to reply and pin corrections today.",
      href: "/comments?status=flagged",
    });
  }

  if (input.uncoveredHighRiskPus > 0) {
    calls.push({
      id: "high-risk-coverage",
      severity: "critical",
      title: "Cover high-risk polling units",
      reason: `${input.uncoveredHighRiskPus} high/critical-risk PU${input.uncoveredHighRiskPus === 1 ? "" : "s"} have no assigned agent.`,
      action: "Deploy PU agents to those units before the next field cycle.",
      href: "/polling-units/agents",
    });
  }

  if (input.pendingComments >= 15) {
    calls.push({
      id: "comment-backlog",
      severity: input.pendingComments >= 40 ? "critical" : "high",
      title: "Clear the comment backlog",
      reason: `${input.pendingComments} comments are still pending — silence reads as weakness online.`,
      action: "Triage by priority score; reply to negatives and undecideds first.",
      href: "/comments?status=pending",
    });
  }

  if (input.agentCoveragePct < 50 && input.uncoveredHighVoterPus > 0) {
    calls.push({
      id: "coverage-gap",
      severity: input.agentCoveragePct < 25 ? "critical" : "high",
      title: "Close field coverage gaps",
      reason: `Only ${input.agentCoveragePct}% of PUs have agents; ${input.uncoveredHighVoterPus} high-register units are uncovered.`,
      action: "Prioritize largest uncovered registers for agent assignment.",
      href: "/polling-units/agents",
    });
  }

  if (input.recentNegativeDelta >= 5 || input.negativeShare >= 40) {
    calls.push({
      id: "sentiment-slide",
      severity: input.negativeShare >= 55 ? "critical" : "high",
      title: "Stop the sentiment slide",
      reason:
        input.recentNegativeDelta >= 5
          ? `Negative comments rose by ${input.recentNegativeDelta} vs the prior window.`
          : `${input.negativeShare}% of classified comments are negative.`,
      action: "Push counter-narrative content and ward visits in the hottest areas.",
      href: "/sentiment",
    });
  }

  if (input.hotIssue && input.hotIssue.negative >= 3) {
    calls.push({
      id: "issue-message",
      severity: "high",
      title: `Message on ${input.hotIssue.topic}`,
      reason: `${input.hotIssue.topic} is drawing heat (${input.hotIssue.negative} negative / ${input.hotIssue.total} total).`,
      action: "Brief spokespeople and publish a concrete plan post on this issue.",
      href: "/social",
    });
  }

  if (input.pressureWard && input.pressureWard.negativePct >= 45 && input.pressureWard.negative >= 3) {
    calls.push({
      id: "ward-pressure",
      severity: "high",
      title: `Stabilize ${input.pressureWard.ward}`,
      reason: `${input.pressureWard.negativePct}% negative chatter in ${input.pressureWard.ward} (${input.pressureWard.negative} negatives).`,
      action: "Schedule a ward touchpoint and task local volunteers for door/SMS outreach.",
      href: "/maps",
    });
  }

  if (input.volunteersTrainedPct < 40) {
    calls.push({
      id: "train-volunteers",
      severity: input.volunteersTrainedPct < 20 ? "high" : "watch",
      title: "Accelerate volunteer training",
      reason: `Only ${input.volunteersTrainedPct}% of volunteers are marked trained.`,
      action: "Run a short training block before the next canvass weekend.",
      href: "/volunteers",
    });
  }

  if (input.totalContacts >= 20 && input.undecidedContacts / Math.max(input.totalContacts, 1) >= 0.35) {
    calls.push({
      id: "persuasion",
      severity: "watch",
      title: "Convert undecided contacts",
      reason: `${input.undecidedContacts} CRM contacts are still undecided.`,
      action: "Segment undecideds by ward and run a persuasion SMS/call wave.",
      href: "/crm",
    });
  }

  if (
    input.daysToElection != null &&
    input.daysToElection <= 45 &&
    input.upcomingEvents === 0
  ) {
    calls.push({
      id: "field-calendar",
      severity: input.daysToElection <= 21 ? "high" : "watch",
      title: "Fill the field calendar",
      reason: `${input.daysToElection} day${input.daysToElection === 1 ? "" : "s"} to election and no upcoming events on the books.`,
      action: "Lock ward rallies / market walks in pressure LGAs this week.",
      href: "/events",
    });
  }

  if (input.flaggedComments > 0 && input.misinfoOpen === 0) {
    calls.push({
      id: "flagged",
      severity: "watch",
      title: "Review flagged comments",
      reason: `${input.flaggedComments} flagged thread${input.flaggedComments === 1 ? "" : "s"} need human judgment.`,
      action: "Escalate abusive or risky threads to legal/comms.",
      href: "/comments?status=flagged",
    });
  }

  if (calls.length === 0) {
    calls.push({
      id: "hold-course",
      severity: "watch",
      title: "Hold course — no red alerts",
      reason: "No critical pressure signals from comments, coverage, or ground game right now.",
      action: "Keep daily triage on comments and confirm agent check-ins.",
      href: "/dashboard",
    });
  }

  return calls.sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]).slice(0, 8);
}

export function daysUntil(iso: string | null | undefined, now = new Date()): number | null {
  if (!iso) return null;
  const target = new Date(iso);
  if (Number.isNaN(target.getTime())) return null;
  const ms = target.getTime() - now.getTime();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

export function pct(part: number, whole: number): number {
  if (!whole) return 0;
  return Math.round((part / whole) * 100);
}
