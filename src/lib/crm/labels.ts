export type CrmPublicKind = "supporter" | "donor";

export const SUPPORT_INTEREST = "support";

export function isInvalidContactTypeError(message: string | null | undefined) {
  const text = (message ?? "").toLowerCase();
  return text.includes("contact_type") || text.includes("invalid input value for enum");
}

export function contactTypeLabel(type?: string | null, interests?: string[] | null) {
  if (type === "donor") return "Donor";
  if (type === "supporter" || interests?.includes(SUPPORT_INTEREST)) return "Support";
  return (type ?? "individual").replace(/_/g, " ");
}

/** Donor wins if they both volunteered and gave. Support does not overwrite Donor. */
export function resolvedContactType(
  existingType: string | null | undefined,
  incoming: CrmPublicKind
): "supporter" | "donor" | string {
  if (existingType === "donor" || incoming === "donor") return "donor";
  if (existingType === "supporter" || incoming === "supporter") return "supporter";
  return existingType || incoming;
}

export function mergeInterests(existing: string[] | null | undefined, incoming: CrmPublicKind) {
  const next = new Set((existing ?? []).map((item) => item.trim()).filter(Boolean));
  if (incoming === "supporter") next.add(SUPPORT_INTEREST);
  return [...next];
}
