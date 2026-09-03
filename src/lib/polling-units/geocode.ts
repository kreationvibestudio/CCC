/** Nigeria mainland + nearby islands (rejects the civic dataset's Canada/US outliers). */
export const NIGERIA_BBOX = { latMin: 4.15, latMax: 13.95, lngMin: 2.55, lngMax: 14.85 };

export const GEOCODE_USER_AGENT = "CampaignCommandCenter/1.1 (polling-unit-geocoder)";

export type PollingUnitGeocodeInput = {
  name: string;
  address?: string | null;
  ward: string;
  lga: string;
  state: string;
};

export type GeocodeHit = {
  lat: number;
  lng: number;
  label: string;
  provider: string;
  query: string;
  score: number;
};

export type GeocodeProviderName = "google" | "mapbox" | "photon" | "nominatim";

type ProviderHit = { lat: number; lng: number; label: string };

const STATE_ALIASES: Record<string, string> = {
  fct: "Abuja, Federal Capital Territory",
  fc: "Abuja, Federal Capital Territory",
  "federal capital territory": "Abuja, Federal Capital Territory",
  "abuja fct": "Abuja, Federal Capital Territory",
  abuja: "Abuja, Federal Capital Territory",
  "fct abuja": "Abuja, Federal Capital Territory",
};

const LGA_ALIASES: Record<string, string> = {
  municipal: "Abuja Municipal",
  amac: "Abuja Municipal",
  "municipal area council": "Abuja Municipal",
  "abuja municipal": "Abuja Municipal",
};

const ABUJA_DISTRICTS = [
  "Maitama",
  "Wuse II",
  "Wuse 2",
  "Wuse",
  "Garki II",
  "Garki 2",
  "Garki",
  "Asokoro",
  "Gwarinpa",
  "Kubwa",
  "Nyanya",
  "Karu",
  "Lugbe",
  "Jabi",
  "Utako",
  "Gudu",
  "Guzape",
  "Katampe",
  "Mabushi",
  "Wuye",
  "Durumi",
  "Apo",
  "Gwagwalada",
  "Kuje",
  "Bwari",
  "Kwali",
  "Central Area",
  "Three Arms Zone",
];

const STOP_TOKENS = new Set([
  "the",
  "and",
  "off",
  "near",
  "opp",
  "opposite",
  "beside",
  "behind",
  "front",
  "infront",
  "by",
  "of",
  "at",
  "to",
  "ii",
  "iii",
  "iv",
  "rd",
  "st",
]);

export function isInNigeria(lat: number, lng: number) {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= NIGERIA_BBOX.latMin &&
    lat <= NIGERIA_BBOX.latMax &&
    lng >= NIGERIA_BBOX.lngMin &&
    lng <= NIGERIA_BBOX.lngMax
  );
}

export function expandStateForGeocode(state: string) {
  const raw = (state || "").trim();
  if (!raw) return "Nigeria";
  const alias = STATE_ALIASES[raw.toLowerCase()];
  if (alias) return alias;
  if (/^[A-Z]{2,3}$/.test(raw) && raw !== "FCT") {
    return `${raw.slice(0, 1)}${raw.slice(1).toLowerCase()} State`;
  }
  if (raw === raw.toUpperCase() && raw.length > 3) {
    return titleCase(raw.toLowerCase());
  }
  return raw;
}

export function expandLgaForGeocode(lga: string, state: string) {
  const raw = (lga || "").trim();
  const alias = LGA_ALIASES[raw.toLowerCase()];
  if (alias) return alias;
  if (/fct|abuja|federal capital/i.test(state) && /^0?\d+$/.test(raw)) {
    return "Abuja Municipal";
  }
  return raw;
}

export function titleCase(value: string) {
  return value
    .toLowerCase()
    .replace(/(^|[\s/,-])([a-z])/g, (_, sep: string, ch: string) => `${sep}${ch.toUpperCase()}`);
}

export function cleanLocationFragment(raw: string) {
  let s = (raw || "").replace(/\s+/g, " ").trim();
  s = s.replace(/\b(\d+)\s*\/\s*RD\.?\b/gi, "$1rd");
  s = s.replace(/\bPRI\.?\s*SCH\.?/gi, "Primary School");
  s = s.replace(/\bSEC\.?\s*SCH\.?/gi, "Secondary School");
  s = s.replace(/\bG\.?\s*S\.?\s*S\.?/gi, "Government Secondary School");
  s = s.replace(/\bQTRS?\b/gi, "Quarters");
  s = s.replace(/\bJUNCT(?:ION)?\b/gi, "Junction");
  s = s.replace(/\bRD\.?\b/gi, "Road");
  // Expand trailing "ST" / "St." street abbreviations only — not "St. Mary".
  s = s.replace(/\b([A-Za-z][A-Za-z']*)\s+ST\.?\b/gi, "$1 Street");
  s = s.replace(/\s*\/\s*/g, ", ");
  return s.replace(/\s+/g, " ").replace(/^,|,$/g, "").trim();
}

export function extractStreetHints(name: string): string[] {
  const cleaned = cleanLocationFragment(name);
  const hints: string[] = [];
  const push = (value: string) => {
    const next = value.replace(/\s+/g, " ").trim();
    if (next.length >= 3 && !hints.some((h) => h.toLowerCase() === next.toLowerCase())) {
      hints.push(next);
    }
  };

  const streetRe =
    /\b([A-Za-z][A-Za-z']+(?:\s+[A-Za-z][A-Za-z']+){0,3})\s+(Street|Road|Close|Lane|Avenue|Crescent|Way|Boulevard|Junction)\b/gi;
  let match: RegExpExecArray | null;
  while ((match = streetRe.exec(cleaned))) {
    push(`${titleCase(match[1])} ${match[2]}`);
  }

  const junctionFirst = /\bJunction\s+([A-Za-z][A-Za-z']+)\b/gi;
  while ((match = junctionFirst.exec(cleaned))) {
    push(`${titleCase(match[1])} Junction`);
    push(`${titleCase(match[1])} Street`);
  }

  for (const part of (name || "").split(/[/,]/)) {
    const token = cleanLocationFragment(part);
    if (/\b(Street|Road|Close|Lane|Avenue|Crescent|Way|Junction)\b/i.test(token)) {
      push(token);
    }
  }

  return hints.slice(0, 4);
}

export function extractDistrictHints(name: string, ward: string): string[] {
  const haystack = `${name} ${ward}`;
  const found: string[] = [];
  for (const district of ABUJA_DISTRICTS) {
    const re = new RegExp(`\\b${district.replace(/\s+/g, "\\s+")}\\b`, "i");
    if (re.test(haystack) && !found.some((d) => d.toLowerCase() === district.toLowerCase())) {
      found.push(district);
    }
  }
  return found;
}

function uniqueQueries(queries: Array<string | null | undefined>) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of queries) {
    const q = (raw || "").replace(/\s+/g, " ").replace(/\s+,/g, ",").trim();
    if (!q) continue;
    const key = q.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(q);
  }
  return out;
}

/** Most-specific first. Never hardcodes a state — uses the row's own state/LGA/ward. */
export function buildGeocodeQueries(unit: PollingUnitGeocodeInput): string[] {
  const state = expandStateForGeocode(unit.state);
  const lga = expandLgaForGeocode(unit.lga, unit.state);
  const ward = (unit.ward || "").trim();
  const name = cleanLocationFragment(unit.name);
  const address = unit.address ? cleanLocationFragment(unit.address) : "";
  const streets = extractStreetHints(unit.name);
  const districts = extractDistrictHints(`${unit.name} ${unit.address ?? ""}`, ward);
  const place = districts[0] || ward;

  const queries: Array<string | null> = [];
  for (const street of streets) {
    queries.push(`${street}, ${place}, ${lga}, ${state}, Nigeria`);
    if (place && place.toLowerCase() !== ward.toLowerCase()) {
      queries.push(`${street}, ${ward}, ${lga}, ${state}, Nigeria`);
    }
  }
  if (name) {
    queries.push(`${name}, ${ward}, ${lga}, ${state}, Nigeria`);
    queries.push(`${name}, ${lga}, ${state}, Nigeria`);
  }
  if (address && address.toLowerCase() !== name.toLowerCase()) {
    queries.push(`${address}, ${ward}, ${lga}, ${state}, Nigeria`);
  }
  if (ward) queries.push(`${ward} Ward, ${lga}, ${state}, Nigeria`);
  if (place && place.toLowerCase() !== ward.toLowerCase()) {
    queries.push(`${place}, ${lga}, ${state}, Nigeria`);
  }
  queries.push(`${lga}, ${state}, Nigeria`);
  return uniqueQueries(queries).slice(0, 8);
}

function tokens(value: string) {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 2 && !STOP_TOKENS.has(t));
}

export function scoreGeocodeHit(unit: PollingUnitGeocodeInput, hit: ProviderHit): number {
  if (!isInNigeria(hit.lat, hit.lng)) return -1;
  const label = hit.label.toLowerCase();
  if (!label) return -1;
  if (/\bnigeria\b/.test(label) && label.split(",").length <= 2) return -1;

  const state = expandStateForGeocode(unit.state).toLowerCase();
  const lga = expandLgaForGeocode(unit.lga, unit.state).toLowerCase();
  const ward = (unit.ward || "").toLowerCase();
  const streets = extractStreetHints(unit.name);
  const districts = extractDistrictHints(`${unit.name} ${unit.address ?? ""}`, unit.ward);

  let score = 0;
  if (label.includes("nigeria")) score += 1;
  if (state.split(",").some((part) => part.trim() && label.includes(part.trim()))) score += 2;
  if (lga && label.includes(lga)) score += 3;
  if (/\bmunicipal\b/.test(lga) && /\bmunicipal\b/.test(label)) score += 3;
  if (ward && label.includes(ward)) score += 3;
  for (const street of streets) {
    const core = street.replace(/\b(street|road|junction|close|lane|avenue|crescent|way)\b/gi, "").trim();
    if (core && label.includes(core.toLowerCase())) score += 6;
  }
  for (const district of districts) {
    if (label.includes(district.toLowerCase())) score += 4;
  }

  const nameTokens = tokens(`${unit.name} ${unit.address ?? ""}`);
  const labelTokens = new Set(tokens(hit.label));
  for (const token of nameTokens) {
    if (labelTokens.has(token)) score += 1;
  }

  for (const district of districts) {
    const others = ABUJA_DISTRICTS.filter(
      (d) => d.toLowerCase() !== district.toLowerCase() && !d.toLowerCase().includes(district.toLowerCase())
    );
    if (others.some((d) => label.includes(d.toLowerCase())) && !label.includes(district.toLowerCase())) {
      score -= 5;
    }
  }

  return score;
}

export const MIN_ACCEPT_SCORE = 5;

export function pickBestHit(
  unit: PollingUnitGeocodeInput,
  hits: ProviderHit[],
  provider: string,
  query: string
): GeocodeHit | null {
  let best: GeocodeHit | null = null;
  for (const hit of hits) {
    const score = scoreGeocodeHit(unit, hit);
    if (score < MIN_ACCEPT_SCORE) continue;
    if (!best || score > best.score) {
      best = { ...hit, provider, query, score };
    }
  }
  return best;
}

function googleKey() {
  return (
    process.env.GOOGLE_GEOCODING_API_KEY?.trim() ||
    process.env.GOOGLE_MAPS_API_KEY?.trim() ||
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() ||
    ""
  );
}

function mapboxToken() {
  return process.env.MAPBOX_GEOCODING_TOKEN?.trim() || process.env.NEXT_PUBLIC_MAPBOX_TOKEN?.trim() || "";
}

export function detectGeocodeProviders(): GeocodeProviderName[] {
  const ordered: GeocodeProviderName[] = [];
  if (googleKey() && googleKey() !== "[SENSITIVE]") ordered.push("google");
  if (mapboxToken() && mapboxToken() !== "[SENSITIVE]" && mapboxToken().length > 10) ordered.push("mapbox");
  ordered.push("photon", "nominatim");
  return ordered;
}

export function providerDelayMs(provider: GeocodeProviderName) {
  if (provider === "nominatim") return 1100;
  if (provider === "photon") return 150;
  return 80;
}

async function searchNominatim(query: string, fetcher: typeof fetch): Promise<ProviderHit[]> {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", query);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "5");
  url.searchParams.set("countrycodes", "ng");
  url.searchParams.set("addressdetails", "1");
  const res = await fetcher(url, { headers: { "User-Agent": GEOCODE_USER_AGENT, Accept: "application/json" } });
  if (!res.ok) return [];
  const data = (await res.json()) as Array<{ lat: string; lon: string; display_name?: string }>;
  return (data ?? []).map((row) => ({
    lat: Number(row.lat),
    lng: Number(row.lon),
    label: row.display_name ?? "",
  }));
}

async function searchPhoton(query: string, fetcher: typeof fetch): Promise<ProviderHit[]> {
  const url = new URL("https://photon.komoot.io/api");
  url.searchParams.set("q", query);
  url.searchParams.set("limit", "5");
  url.searchParams.set("lang", "en");
  const res = await fetcher(url, { headers: { "User-Agent": GEOCODE_USER_AGENT, Accept: "application/json" } });
  if (!res.ok) return [];
  const data = (await res.json()) as {
    features?: Array<{
      geometry?: { coordinates?: number[] };
      properties?: Record<string, string | undefined>;
    }>;
  };
  return (data.features ?? [])
    .map((feature) => {
      const coords = feature.geometry?.coordinates;
      if (!coords || coords.length < 2) return null;
      const p = feature.properties ?? {};
      const label = [p.name, p.street, p.district, p.city, p.county, p.state, p.country].filter(Boolean).join(", ");
      return { lat: Number(coords[1]), lng: Number(coords[0]), label };
    })
    .filter((row): row is ProviderHit => Boolean(row));
}

async function searchGoogle(query: string, fetcher: typeof fetch): Promise<ProviderHit[]> {
  const key = googleKey();
  if (!key) return [];
  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("address", query);
  url.searchParams.set("region", "ng");
  url.searchParams.set("components", "country:NG");
  url.searchParams.set("key", key);
  const res = await fetcher(url);
  if (!res.ok) return [];
  const data = (await res.json()) as {
    results?: Array<{ formatted_address?: string; geometry?: { location?: { lat: number; lng: number } } }>;
  };
  return (data.results ?? [])
    .map((row) => {
      const loc = row.geometry?.location;
      if (!loc) return null;
      return { lat: Number(loc.lat), lng: Number(loc.lng), label: row.formatted_address ?? "" };
    })
    .filter((row): row is ProviderHit => Boolean(row));
}

async function searchMapbox(query: string, fetcher: typeof fetch): Promise<ProviderHit[]> {
  const token = mapboxToken();
  if (!token) return [];
  const url = new URL(
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json`
  );
  url.searchParams.set("access_token", token);
  url.searchParams.set("country", "ng");
  url.searchParams.set("limit", "5");
  const res = await fetcher(url);
  if (!res.ok) return [];
  const data = (await res.json()) as {
    features?: Array<{ place_name?: string; center?: number[] }>;
  };
  return (data.features ?? [])
    .map((feature) => {
      const center = feature.center;
      if (!center || center.length < 2) return null;
      return { lat: Number(center[1]), lng: Number(center[0]), label: feature.place_name ?? "" };
    })
    .filter((row): row is ProviderHit => Boolean(row));
}

async function searchProvider(
  provider: GeocodeProviderName,
  query: string,
  fetcher: typeof fetch
): Promise<ProviderHit[]> {
  if (provider === "google") return searchGoogle(query, fetcher);
  if (provider === "mapbox") return searchMapbox(query, fetcher);
  if (provider === "photon") return searchPhoton(query, fetcher);
  return searchNominatim(query, fetcher);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function geocodePollingUnit(
  unit: PollingUnitGeocodeInput,
  options?: {
    providers?: GeocodeProviderName[];
    fetcher?: typeof fetch;
    delay?: (provider: GeocodeProviderName) => Promise<void>;
  }
): Promise<GeocodeHit | null> {
  const providers = options?.providers?.length ? options.providers : detectGeocodeProviders();
  const fetcher = options?.fetcher ?? fetch;
  const queries = buildGeocodeQueries(unit);
  let best: GeocodeHit | null = null;

  for (const provider of providers) {
    for (const query of queries) {
      try {
        const hits = await searchProvider(provider, query, fetcher);
        const picked = pickBestHit(unit, hits, provider, query);
        if (picked && (!best || picked.score > best.score)) best = picked;
        if (picked && picked.score >= 12) return picked;
      } catch {
        // try the next query/provider
      }
      if (options?.delay) await options.delay(provider);
      else await sleep(providerDelayMs(provider));
    }
    if (best && best.score >= 8) return best;
  }

  return best;
}
