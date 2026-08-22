/** Keys starting with `_` stay on the device (queued photo paths). */
export function publicPayload(payload: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (key.startsWith("_")) continue;
    if (value == null || value === "") continue;
    out[key] = value;
  }
  return out;
}

export function localPhoto(
  payload: Record<string, unknown>
): { uri: string; kind: "result_sheet" | "incident" } | null {
  const uri = typeof payload._localPhoto === "string" ? payload._localPhoto : "";
  const kind =
    payload._photoKind === "result_sheet"
      ? "result_sheet"
      : payload._photoKind === "incident"
        ? "incident"
        : null;
  if (!uri || !kind) return null;
  return { uri, kind };
}
