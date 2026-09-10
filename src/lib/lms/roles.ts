export const VOLUNTEER_SUPPORT_ROLES = [
  { slug: "field_canvassing", name: "Field canvassing / door-to-door outreach", short: "Canvassing" },
  { slug: "phone_banking", name: "Phone banking", short: "Phone bank" },
  { slug: "voter_registration", name: "Voter registration support", short: "Voter reg" },
  { slug: "digital_outreach", name: "Social media and digital outreach", short: "Digital" },
  { slug: "event_support", name: "Event and rally support", short: "Events" },
  { slug: "polling_day", name: "Polling-day operations", short: "Polling day" },
  { slug: "data_crm", name: "Data entry / CRM support", short: "Data / CRM" },
  { slug: "community_outreach", name: "Community outreach", short: "Community" },
  { slug: "fundraising", name: "Fundraising", short: "Fundraising" },
  { slug: "team_leadership", name: "Volunteer team leadership", short: "Team lead" },
] as const;

export type SupportRoleSlug = (typeof VOLUNTEER_SUPPORT_ROLES)[number]["slug"];

const SLUGS = new Set<string>(VOLUNTEER_SUPPORT_ROLES.map((r) => r.slug));

export function isSupportRoleSlug(value: string): value is SupportRoleSlug {
  return SLUGS.has(value);
}

export function supportRoleLabel(slug: string | null | undefined): string {
  return VOLUNTEER_SUPPORT_ROLES.find((r) => r.slug === slug)?.name ?? slug ?? "General";
}

export function supportRoleShort(slug: string | null | undefined): string {
  return VOLUNTEER_SUPPORT_ROLES.find((r) => r.slug === slug)?.short ?? slug ?? "General";
}

export function parseSupportRoles(raw: unknown): SupportRoleSlug[] {
  const list = Array.isArray(raw)
    ? raw
    : typeof raw === "string"
      ? raw.split(",")
      : [];
  const seen = new Set<SupportRoleSlug>();
  for (const item of list) {
    const slug = String(item).trim();
    if (isSupportRoleSlug(slug)) seen.add(slug);
  }
  return [...seen];
}

const SKILL_HINTS: Array<{ re: RegExp; slug: SupportRoleSlug }> = [
  { re: /canvas|door|field/i, slug: "field_canvassing" },
  { re: /phone|call/i, slug: "phone_banking" },
  { re: /regist|pvc|cvr/i, slug: "voter_registration" },
  { re: /social|media|digital/i, slug: "digital_outreach" },
  { re: /event|rally/i, slug: "event_support" },
  { re: /poll|election day/i, slug: "polling_day" },
  { re: /data|crm|entry/i, slug: "data_crm" },
  { re: /community|outreach/i, slug: "community_outreach" },
  { re: /fund|donor/i, slug: "fundraising" },
  { re: /lead|supervisor|coord/i, slug: "team_leadership" },
];

export function inferSupportRoles(skills: string[] | null | undefined): SupportRoleSlug[] {
  const found = new Set<SupportRoleSlug>();
  for (const skill of skills ?? []) {
    for (const hint of SKILL_HINTS) {
      if (hint.re.test(skill)) found.add(hint.slug);
    }
  }
  return [...found];
}
