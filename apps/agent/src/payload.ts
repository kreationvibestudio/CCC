export type AgentMediaKind = "result_sheet" | "incident" | "report";

export type LocalMediaItem = {
  uri: string;
  kind: AgentMediaKind;
  mediaType: "photo" | "video";
};

/** Keys starting with `_` stay on the device (queued media paths). */
export function publicPayload(payload: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (key.startsWith("_")) continue;
    if (value == null || value === "") continue;
    out[key] = value;
  }
  return out;
}

export function localMediaList(payload: Record<string, unknown>): LocalMediaItem[] {
  const raw = payload._localMedia;
  if (Array.isArray(raw)) {
    return raw
      .map((row) => {
        if (!row || typeof row !== "object") return null;
        const uri = String((row as { uri?: string }).uri ?? "");
        const kind = (row as { kind?: AgentMediaKind }).kind;
        if (!uri || !kind) return null;
        const mediaType =
          (row as { mediaType?: string }).mediaType === "video" ? "video" : "photo";
        return { uri, kind, mediaType } satisfies LocalMediaItem;
      })
      .filter(Boolean) as LocalMediaItem[];
  }
  const legacy = localPhoto(payload);
  if (!legacy) return [];
  return [{ uri: legacy.uri, kind: legacy.kind, mediaType: "photo" }];
}

/** @deprecated single-photo queue keys */
export function localPhoto(
  payload: Record<string, unknown>
): { uri: string; kind: AgentMediaKind } | null {
  const uri = typeof payload._localPhoto === "string" ? payload._localPhoto : "";
  const kind =
    payload._photoKind === "result_sheet"
      ? "result_sheet"
      : payload._photoKind === "incident"
        ? "incident"
        : payload._photoKind === "report"
          ? "report"
          : null;
  if (!uri || !kind) return null;
  return { uri, kind };
}
