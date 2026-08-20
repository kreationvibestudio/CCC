import { parsePartyVotes } from "@/lib/elections/parties";

export const OUR_PARTY = "NDC";
export const RACE_PARTIES = ["NDC", "PDP", "APC", "ADC"] as const;
export type RaceParty = (typeof RACE_PARTIES)[number];

export const PARTY_COLORS: Record<RaceParty, string> = {
  NDC: "#4ade80",
  PDP: "#f87171",
  APC: "#60a5fa",
  ADC: "#fbbf24",
};

export type PuRef = {
  name?: string;
  code?: string;
  ward?: string;
  lga?: string;
  registered_voters?: number | null;
  latitude?: number | null;
  longitude?: number | null;
} | null;

export type ResultRow = {
  id: string;
  polling_unit_id?: string | null;
  total_votes: number;
  submitted_at: string;
  party_votes?: Record<string, number> | null;
  polling_units?: PuRef;
};

export type StatusRow = {
  id: string;
  polling_unit_id?: string | null;
  status: string;
  turnout: number | null;
  polling_units?: PuRef;
};

export type FeedItem = {
  id: string;
  at: string;
  kind: "result" | "incident" | "report" | "status";
  title: string;
  detail: string;
  tone: "win" | "alert" | "info";
};

function emptyVotes(): Record<RaceParty, number> {
  return { NDC: 0, PDP: 0, APC: 0, ADC: 0 };
}

function addVotes(into: Record<string, number>, raw: unknown) {
  const parsed = parsePartyVotes(raw);
  for (const [code, n] of Object.entries(parsed)) {
    into[code] = (into[code] ?? 0) + n;
  }
}

export function latestResultsByPu(results: ResultRow[]): ResultRow[] {
  const map = new Map<string, ResultRow>();
  const sorted = [...results].sort(
    (a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime()
  );
  for (const row of sorted) {
    const key = row.polling_unit_id || row.id;
    if (!map.has(key)) map.set(key, row);
  }
  return [...map.values()];
}

export function buildRaceAnalysis(input: {
  ourParty?: string;
  universePuCount: number;
  universeRegistered: number;
  statuses: StatusRow[];
  results: ResultRow[];
}) {
  const ourParty = (input.ourParty || OUR_PARTY).toUpperCase();
  const latest = latestResultsByPu(input.results);
  const countedVotes = emptyVotes() as Record<string, number>;
  let countedBallots = 0;
  let countedRegistered = 0;
  const lgaMap = new Map<string, { registered: number; votes: Record<string, number> }>();

  for (const row of latest) {
    const parsed = parsePartyVotes(row.party_votes);
    addVotes(countedVotes, parsed);
    const parsedTotal = Object.values(parsed).reduce((s, n) => s + n, 0);
    countedBallots += parsedTotal > 0 ? parsedTotal : row.total_votes || 0;
    const reg = row.polling_units?.registered_voters ?? 0;
    countedRegistered += reg;
    const lga = row.polling_units?.lga || "Unknown";
    const cur = lgaMap.get(lga) ?? { registered: 0, votes: {} };
    cur.registered += reg;
    addVotes(cur.votes, row.party_votes);
    lgaMap.set(lga, cur);
  }

  let accredited = 0;
  let accreditedRegistered = 0;
  for (const s of input.statuses) {
    const t = s.turnout ?? 0;
    if (t > 0) {
      accredited += t;
      accreditedRegistered += s.polling_units?.registered_voters ?? 0;
    }
  }

  const universePuCount = input.universePuCount || latest.length;
  const universeRegistered = input.universeRegistered || countedRegistered || accreditedRegistered;

  const turnoutRate =
    accreditedRegistered > 0
      ? accredited / accreditedRegistered
      : countedRegistered > 0
        ? countedBallots / countedRegistered
        : 0;

  const reportingPct = universeRegistered > 0 ? countedRegistered / universeRegistered : 0;
  const puReportingPct = universePuCount > 0 ? latest.length / universePuCount : 0;

  const share: Record<string, number> = {};
  for (const [code, n] of Object.entries(countedVotes)) {
    share[code] = countedBallots > 0 ? n / countedBallots : 0;
  }

  const remainingRegistered = Math.max(0, universeRegistered - countedRegistered);
  const remainingBallots = remainingRegistered * turnoutRate;
  const projected: Record<string, number> = {};
  for (const code of new Set([...RACE_PARTIES, ...Object.keys(countedVotes)])) {
    projected[code] = (countedVotes[code] ?? 0) + remainingBallots * (share[code] ?? 0);
  }

  const raceCounted = RACE_PARTIES.map((code) => ({
    code,
    counted: countedVotes[code] ?? 0,
    projected: projected[code] ?? 0,
    share: share[code] ?? 0,
  })).sort((a, b) => b.counted - a.counted);

  const othersCounted = Object.entries(countedVotes)
    .filter(([code]) => !RACE_PARTIES.includes(code as RaceParty))
    .reduce((s, [, n]) => s + n, 0);

  const sortedCounted = Object.entries(countedVotes).sort((a, b) => b[1] - a[1]);
  const leader = sortedCounted[0]?.[0] ?? ourParty;
  const ourVotes = countedVotes[ourParty] ?? 0;
  const bestRival = sortedCounted.find(([code]) => code !== ourParty);
  const margin = ourVotes - (bestRival?.[1] ?? 0);
  const projectedOur = projected[ourParty] ?? 0;
  const projectedRival = Math.max(
    0,
    ...RACE_PARTIES.filter((p) => p !== ourParty).map((p) => projected[p] ?? 0)
  );
  const projectedMargin = projectedOur - projectedRival;
  const projectedLeader = Object.entries(projected).sort((a, b) => b[1] - a[1])[0]?.[0] ?? ourParty;

  const chronological = [...latest].sort(
    (a, b) => new Date(a.submitted_at).getTime() - new Date(b.submitted_at).getTime()
  );
  const running = emptyVotes();
  const timeline = chronological.map((row) => {
    const parsed = parsePartyVotes(row.party_votes);
    for (const p of RACE_PARTIES) running[p] += parsed[p] ?? 0;
    return {
      t: new Date(row.submitted_at).toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit" }),
      ...running,
    };
  });

  const lgaBreakdown = [...lgaMap.entries()]
    .map(([lga, v]) => {
      const total = Object.values(v.votes).reduce((s, n) => s + n, 0);
      return {
        lga,
        registered: v.registered,
        total,
        NDC: v.votes.NDC ?? 0,
        PDP: v.votes.PDP ?? 0,
        APC: v.votes.APC ?? 0,
        ADC: v.votes.ADC ?? 0,
        ndcShare: total > 0 ? (v.votes.NDC ?? 0) / total : 0,
      };
    })
    .sort((a, b) => b.total - a.total)
    .slice(0, 12);

  return {
    ourParty,
    universePuCount,
    universeRegistered,
    countedPuCount: latest.length,
    countedRegistered,
    countedBallots,
    countedVotes,
    accredited,
    accreditedRegistered,
    turnoutRate,
    reportingPct,
    puReportingPct,
    share,
    projected,
    remainingBallots,
    raceCounted,
    othersCounted,
    leader,
    margin,
    projectedLeader,
    projectedMargin,
    timeline,
    lgaBreakdown,
    incompleteUniverse: !input.universeRegistered,
  };
}

export type RaceAnalysis = ReturnType<typeof buildRaceAnalysis>;

export function buildLiveFeed(input: {
  results: ResultRow[];
  incidents: Array<{ id: string; title: string; severity: string; is_emergency: boolean; created_at: string }>;
  agentReports: Array<{ id: string; report_type: string; content: string; created_at: string; profiles?: { full_name: string } | null }>;
  ourParty?: string;
}): FeedItem[] {
  const ourParty = (input.ourParty || OUR_PARTY).toUpperCase();
  const items: FeedItem[] = [];

  for (const r of input.results) {
    const votes = parsePartyVotes(r.party_votes);
    const winner = Object.entries(votes).sort((a, b) => b[1] - a[1])[0];
    const pu = r.polling_units?.code || r.polling_units?.name || "Polling unit";
    items.push({
      id: `result-${r.id}`,
      at: r.submitted_at,
      kind: "result",
      title: `${pu} result in`,
      detail: winner
        ? `${winner[0]} ${winner[1].toLocaleString()} · ${r.total_votes.toLocaleString()} votes`
        : `${r.total_votes.toLocaleString()} votes`,
      tone: winner?.[0] === ourParty ? "win" : "info",
    });
  }

  for (const i of input.incidents) {
    items.push({
      id: `incident-${i.id}`,
      at: i.created_at,
      kind: "incident",
      title: i.is_emergency ? `Emergency: ${i.title}` : i.title,
      detail: i.severity,
      tone: "alert",
    });
  }

  for (const r of input.agentReports) {
    items.push({
      id: `report-${r.id}`,
      at: r.created_at,
      kind: "report",
      title: `${r.profiles?.full_name ?? "Agent"} · ${r.report_type.replace(/_/g, " ")}`,
      detail: r.content.slice(0, 120),
      tone: "info",
    });
  }

  return items.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()).slice(0, 18);
}
