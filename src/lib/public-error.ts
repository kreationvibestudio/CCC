/** Turn unknown thrown/returned values into a toast-safe string. */
export function toErrorMessage(error: unknown, fallback = "Something went wrong"): string {
  if (error == null || error === "") return fallback;
  if (typeof error === "string") {
    const text = error.trim();
    return text && text !== "{}" ? text : fallback;
  }
  if (error instanceof Error) {
    const text = error.message.trim();
    if (text && text !== "{}") return text;
  }
  if (typeof error === "object") {
    const rec = error as Record<string, unknown>;
    for (const key of ["message", "error", "details", "hint"]) {
      const value = rec[key];
      if (typeof value === "string" && value.trim() && value.trim() !== "{}") return value.trim();
    }
  }
  return fallback;
}

/** PostgREST / Postgres when a table or type was never migrated. */
export function isMissingRelationError(message: string | undefined, relation: string) {
  if (!message) return false;
  const haystack = message.toLowerCase();
  const name = relation.toLowerCase();
  return haystack.includes(name) && (
    haystack.includes("schema cache") ||
    haystack.includes("does not exist") ||
    haystack.includes("pgrst205")
  );
}
