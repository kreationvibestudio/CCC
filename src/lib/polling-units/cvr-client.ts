/** Live INEC CVR polling-unit endpoints (cvr.inecnigeria.org). Pull only — INEC has no webhook. */

export const CVR_BASE = "https://cvr.inecnigeria.org";
export const CVR_STATE_ID = "12";
export const CVR_USER_AGENT =
  "CampaignCommandCenter/1.2 (Edo PU CVR poller; +https://github.com/kreationvibestudio/CCC)";

export type CvrOption = {
  id: string;
  code: string;
  label: string;
};

export type LocatorPin = {
  latitude: number;
  longitude: number;
  mapsUrl: string;
};

export type CvrFetch = (input: string | URL, init?: RequestInit) => Promise<Response>;

export function parseLabeled(value: unknown): { code: string; label: string } {
  const raw = String(value ?? "").trim();
  const match = raw.match(/^(\d+)\s*-\s*(.+)$/);
  if (!match) return { code: "", label: raw };
  return { code: match[1], label: match[2].trim() };
}

export function parseCvrSearchPayload(data: unknown): CvrOption[] {
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== "object") return [];
  return Object.entries(row as Record<string, unknown>)
    .filter(([key, value]) => key !== "0" && key !== "selected" && value != null && value !== "")
    .map(([id, label]) => ({ id: String(id), ...parseLabeled(label) }))
    .filter((item) => item.id && item.label);
}

export function parseLocatorRedirect(location: string): LocatorPin | { query: string } | null {
  const mapsUrl = location.trim();
  if (!mapsUrl) return null;
  const coords = mapsUrl.match(/[?&]q=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  if (coords) {
    return { latitude: Number(coords[1]), longitude: Number(coords[2]), mapsUrl };
  }
  const text = mapsUrl.match(/[?&]q=([^&]+)/);
  if (!text) return null;
  return { query: decodeURIComponent(text[1].replace(/\+/g, " ")) };
}

function applySetCookie(jar: Map<string, string>, res: Response) {
  const headers = res.headers as Headers & { getSetCookie?: () => string[] };
  const setCookie = typeof headers.getSetCookie === "function" ? headers.getSetCookie() : [];
  const parts = setCookie.length ? setCookie : res.headers.get("set-cookie") ? [res.headers.get("set-cookie")!] : [];
  for (const raw of parts) {
    const part = raw.split(";")[0];
    const eq = part.indexOf("=");
    if (eq > 0) jar.set(part.slice(0, eq), part.slice(eq + 1));
  }
}

export type CvrClient = {
  request: (url: string, init?: RequestInit) => Promise<Response>;
  fetchOptions: (kind: "lgas" | "wards" | "pus", parentKey: string, parentId: string) => Promise<CvrOption[]>;
  locate: (lgaId: string, wardId: string, puId: string) => Promise<LocatorPin>;
};

export async function createCvrClient(options?: {
  fetchImpl?: CvrFetch;
  base?: string;
  delayMs?: number;
}): Promise<CvrClient> {
  const fetchImpl = options?.fetchImpl ?? fetch;
  const base = (options?.base ?? CVR_BASE).replace(/\/$/, "");
  const delayMs = Math.max(options?.delayMs ?? 40, 0);
  const jar = new Map<string, string>();

  async function request(url: string, init: RequestInit = {}) {
    if (delayMs) await new Promise((resolve) => setTimeout(resolve, delayMs));
    const headers = new Headers(init.headers);
    headers.set("User-Agent", CVR_USER_AGENT);
    if (!headers.has("Accept")) headers.set("Accept", "application/json,text/html,*/*");
    if (jar.size) {
      headers.set(
        "Cookie",
        [...jar.entries()].map(([key, value]) => `${key}=${value}`).join("; ")
      );
    }
    const res = await fetchImpl(url, { ...init, headers, redirect: "manual" });
    applySetCookie(jar, res);
    return res;
  }

  const warm = await request(`${base}/pu`);
  if (warm.status >= 400) {
    throw new Error(`INEC CVR locator is unreachable (HTTP ${warm.status})`);
  }

  async function fetchOptions(kind: "lgas" | "wards" | "pus", parentKey: string, parentId: string) {
    const url = new URL(`${base}/PublicApi/${kind}/1/Search`);
    url.searchParams.set(parentKey, parentId);
    const res = await request(url.toString());
    if (res.status >= 300 && res.status < 400) {
      throw new Error(`INEC CVR ${kind} redirected (${res.status}). Session cookie may have expired.`);
    }
    if (!res.ok) throw new Error(`INEC CVR ${kind} HTTP ${res.status}`);
    return parseCvrSearchPayload(await res.json());
  }

  async function locate(lgaId: string, wardId: string, puId: string): Promise<LocatorPin> {
    const body = new URLSearchParams({
      _method: "POST",
      "data[Search][state_id]": CVR_STATE_ID,
      "data[Search][local_government_id]": lgaId,
      "data[Search][registration_area_id]": wardId,
      "data[Search][polling_unit_id]": puId,
    });
    const res = await request(`${base}/pu_locator/index`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Referer: `${base}/pu`,
      },
      body,
    });
    const location = res.headers.get("location") || "";
    const parsed = parseLocatorRedirect(location);
    if (parsed && "latitude" in parsed) return parsed;
    if (parsed && "query" in parsed) {
      throw new Error(`INEC locator returned a place name instead of coordinates: ${parsed.query.slice(0, 80)}`);
    }
    throw new Error(`No lat/lng in INEC locator redirect (${res.status}): ${location.slice(0, 120)}`);
  }

  return { request, fetchOptions, locate };
}
