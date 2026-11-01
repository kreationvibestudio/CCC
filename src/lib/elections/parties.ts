/** INEC-registered Nigerian political parties (workspace + result sheets). */
export type PartyOption = { code: string; name: string };

/**
 * Full register as published by INEC (21+ parties including DLA / NDC / NDP).
 * Sorted by abbreviation for dropdowns.
 * @see https://inecnigeria.org/parties
 */
export const REGISTERED_PARTIES: PartyOption[] = [
  { code: "A", name: "Accord" },
  { code: "AA", name: "Action Alliance" },
  { code: "AAC", name: "African Action Congress" },
  { code: "ADC", name: "African Democratic Congress" },
  { code: "ADP", name: "Action Democratic Party" },
  { code: "APC", name: "All Progressives Congress" },
  { code: "APGA", name: "All Progressives Grand Alliance" },
  { code: "APM", name: "Allied Peoples Movement" },
  { code: "APP", name: "Action Peoples Party" },
  { code: "BP", name: "Boot Party" },
  { code: "DLA", name: "Democratic Leadership Alliance" },
  { code: "LP", name: "Labour Party" },
  { code: "NDC", name: "Nigeria Democratic Congress" },
  { code: "NDP", name: "National Democratic Party" },
  { code: "NNPP", name: "New Nigeria Peoples Party" },
  { code: "NRM", name: "National Rescue Movement" },
  { code: "PDP", name: "Peoples Democratic Party" },
  { code: "PRP", name: "Peoples Redemption Party" },
  { code: "SDP", name: "Social Democratic Party" },
  { code: "YP", name: "Youth Party" },
  { code: "YPP", name: "Young Progressives Party" },
  { code: "ZLP", name: "Zenith Labour Party" },
];

/** Parties highlighted first on Agent Portal result sheets. */
export const FEATURED_PARTIES: PartyOption[] = [
  { code: "APC", name: "All Progressives Congress" },
  { code: "PDP", name: "Peoples Democratic Party" },
  { code: "LP", name: "Labour Party" },
  { code: "NNPP", name: "New Nigeria Peoples Party" },
  { code: "ADC", name: "African Democratic Congress" },
  { code: "NDC", name: "Nigeria Democratic Congress" },
];

const featuredCodes = new Set(FEATURED_PARTIES.map((p) => p.code));

/** Remaining registered parties (result sheet “show others”). */
export const OTHER_MAJOR_PARTIES: PartyOption[] = REGISTERED_PARTIES.filter(
  (p) => !featuredCodes.has(p.code)
);

export const RESULT_PARTIES: PartyOption[] = [...FEATURED_PARTIES, ...OTHER_MAJOR_PARTIES];

export function partyLabel(code: string) {
  const needle = code.trim().toUpperCase();
  const found = REGISTERED_PARTIES.find((p) => p.code === needle);
  return found ? `${found.code} — ${found.name}` : code;
}

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
