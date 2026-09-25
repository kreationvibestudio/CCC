import type { UserRole } from "@/types/auth";

/** Profile name must look like Akin Anenih (case / spacing flexible). */
const NAME_PATTERN = /\bakin\b[\s.',-]*\banenih\b|\banenih\b[\s.',-]*\bakin\b/i;

function normalizeName(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[_]+/g, " ")
    .trim();
}

/** Optional comma-separated emails that may open Sales / pitch deck. */
export function pitchDeckAllowedEmails(): string[] {
  const raw = process.env.PITCH_DECK_ALLOWED_EMAILS ?? "";
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function isAkinAnenihName(fullName: string | null | undefined): boolean {
  if (!fullName?.trim()) return false;
  return NAME_PATTERN.test(normalizeName(fullName));
}

type PitchDeckUser = {
  role: UserRole;
  email: string;
  profile?: { full_name?: string | null } | null;
};

/**
 * Pitch deck / Sales folder is only for Akin Anenih as Super Administrator.
 * Email allowlist is an optional escape hatch (ops / name typos).
 */
export function canAccessPitchDeck(user: PitchDeckUser | null | undefined): boolean {
  if (!user) return false;
  if (user.role !== "super_administrator") return false;
  if (pitchDeckAllowedEmails().includes(user.email.toLowerCase())) return true;
  return isAkinAnenihName(user.profile?.full_name);
}
