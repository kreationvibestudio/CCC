export type PartyOption = { code: string; name: string };

export const FEATURED_PARTIES: PartyOption[] = [
  { code: "APC", name: "All Progressives Congress" },
  { code: "PDP", name: "Peoples Democratic Party" },
  { code: "NDC", name: "National Democratic Coalition" },
  { code: "ADC", name: "African Democratic Congress" },
];

export const OTHER_MAJOR_PARTIES: PartyOption[] = [
  { code: "LP", name: "Labour Party" },
  { code: "NNPP", name: "New Nigeria Peoples Party" },
  { code: "APGA", name: "All Progressives Grand Alliance" },
  { code: "SDP", name: "Social Democratic Party" },
  { code: "YPP", name: "Young Progressives Party" },
  { code: "AAC", name: "African Action Congress" },
  { code: "ADP", name: "Action Democratic Party" },
  { code: "APM", name: "Allied Peoples Movement" },
  { code: "PRP", name: "Peoples Redemption Party" },
  { code: "ZLP", name: "Zenith Labour Party" },
  { code: "A", name: "Accord" },
];

export function parsePartyVotes(raw: unknown): Record<string, number> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const votes: Record<string, number> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const code = key.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    const n = Number(value);
    if (!code || !Number.isFinite(n) || n < 0) continue;
    votes[code] = Math.round(n);
  }
  return votes;
}

export function totalPartyVotes(votes: Record<string, number>) {
  return Object.values(votes).reduce((sum, n) => sum + n, 0);
}

export function votesFromFields(
  fields: Record<string, string>,
  extras: { code: string; votes: string }[]
) {
  const payload: Record<string, number> = {};
  for (const [code, raw] of Object.entries(fields)) {
    if (raw === "") continue;
    payload[code] = Number(raw);
  }
  for (const extra of extras) {
    const code = extra.code.trim().toUpperCase();
    if (!code || extra.votes === "") continue;
    payload[code] = Number(extra.votes);
  }
  return parsePartyVotes(payload);
}
