export type SyncFailureResponse = {
  status: number;
  statusText: string;
};

export async function readJsonObject(res: Response): Promise<Record<string, unknown> | null> {
  const text = await res.text();
  if (!text.trim()) return null;
  try {
    const parsed = JSON.parse(text) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function facebookSyncFailureMessage(
  res: SyncFailureResponse,
  data: Record<string, unknown> | null
): string {
  if (res.status === 401 || res.status === 403) {
    const server = typeof data?.error === "string" ? data.error.trim() : "";
    if (res.status === 401) {
      return "Your session expired. Sign in again, then sync Facebook.";
    }
    return server || "You do not have permission to sync Facebook.";
  }

  const error = typeof data?.error === "string" ? data.error.trim() : "";
  if (error) return error;

  if (res.status === 504 || res.status === 408 || res.status === 524) {
    return "Facebook sync timed out before it finished. Tap Sync again — HQ now pulls recent posts in shorter batches. If it keeps failing, open Page posts → Connect Facebook to refresh the page token.";
  }

  if (!data) {
    return "Could not read Facebook's reply. Open Page posts → Connect Facebook, paste a never-expiring page token, then sync again.";
  }

  return `Facebook sync failed (HTTP ${res.status}). Open Page posts → Connect Facebook if the token expired.`;
}
