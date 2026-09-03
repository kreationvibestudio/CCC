/** Deterministic approx pins from LGA centroids (Edo campaign). */

const LGA_CENTROIDS: Record<string, [number, number]> = {
  "akoko edo": [7.295, 6.105],
  egor: [6.365, 5.605],
  "esan central": [6.74, 6.2],
  "esan north east": [6.72, 6.33],
  "esan northeast": [6.72, 6.33],
  "esan south east": [6.55, 6.35],
  "esan southeast": [6.55, 6.35],
  "esan west": [6.7, 6.2],
  "etsako central": [7.05, 6.35],
  "etsako east": [7.15, 6.5],
  "etsako west": [7.0, 6.25],
  "etsako north": [7.1, 6.4],
  igueben: [6.6, 6.25],
  "ikpoba okha": [6.3, 5.7],
  oredo: [6.335, 5.627],
  orhionmwon: [6.2, 5.85],
  "ovia north east": [6.45, 5.55],
  "ovia northeast": [6.45, 5.55],
  "ovia south west": [6.4, 5.35],
  "ovia southwest": [6.4, 5.35],
  "owan east": [7.05, 6.05],
  "owan west": [6.95, 5.95],
  uhunmwonde: [6.5, 5.85],
  // Short codes / aliases
  ene: [6.72, 6.33],
  ese: [6.55, 6.35],
  ece: [6.74, 6.2],
  ewe: [6.7, 6.2],
  ovia: [6.45, 5.55],
  ako: [7.295, 6.105],
};

const STATE_FALLBACK: [number, number] = [6.335, 5.627];

function norm(s: string) {
  return String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function hash01(str: string) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}

export function approxPinForPollingUnit(row: {
  code?: string | null;
  name?: string | null;
  ward?: string | null;
  lga?: string | null;
}): { latitude: number; longitude: number } {
  const key = norm(row.lga ?? "");
  const base = LGA_CENTROIDS[key] ?? STATE_FALLBACK;
  const seed = `${row.code ?? ""}|${row.ward ?? ""}|${row.name ?? ""}`;
  const a = hash01(seed);
  const b = hash01(`${seed}|b`);
  const dLat = (a - 0.5) * 0.07;
  const dLng = (b - 0.5) * 0.07;
  return {
    latitude: Number((base[0] + dLat).toFixed(6)),
    longitude: Number((base[1] + dLng).toFixed(6)),
  };
}
