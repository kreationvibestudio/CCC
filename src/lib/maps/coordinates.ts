/** Same mainland bbox as polling-unit geocode — kept local so unit tests need no path aliases. */
const NIGERIA_BBOX = { latMin: 4.15, latMax: 13.95, lngMin: 2.55, lngMax: 14.85 };

export type LatLng = { latitude: number; longitude: number };

function isInNigeria(lat: number, lng: number) {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= NIGERIA_BBOX.latMin &&
    lat <= NIGERIA_BBOX.latMax &&
    lng >= NIGERIA_BBOX.lngMin &&
    lng <= NIGERIA_BBOX.lngMax
  );
}

/**
 * Parse a single coordinate field (latitude or longitude).
 * Accepts plain decimals and rejects NaN / empty.
 */
export function parseCoordinateField(raw: unknown): number | null {
  if (raw == null) return null;
  const text = String(raw).trim();
  if (!text) return null;
  const value = Number(text);
  return Number.isFinite(value) ? value : null;
}

/**
 * Accept Google Maps / phone pastes HQ actually uses in the field:
 * - `6.3346325, 5.6233922`
 * - `6.3346325 5.6233922`
 * - `https://maps.google.com/?q=6.3346325,5.6233922`
 * - `@6.3346325,5.6233922,17z` in a Maps URL
 */
export function parseLatLngPaste(raw: string): LatLng | null {
  const text = raw.trim();
  if (!text) return null;

  const fromUrl = text.match(/[?&]q=(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/i)
    ?? text.match(/@(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/);
  if (fromUrl) {
    const latitude = Number(fromUrl[1]);
    const longitude = Number(fromUrl[2]);
    if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
      return { latitude, longitude };
    }
  }

  const pair = text.match(/^(-?\d+(?:\.\d+)?)\s*[,;\s]\s*(-?\d+(?:\.\d+)?)\s*$/);
  if (pair) {
    const latitude = Number(pair[1]);
    const longitude = Number(pair[2]);
    if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
      return { latitude, longitude };
    }
  }

  return null;
}

export function resolvePollingUnitCoordinates(input: {
  latitude?: unknown;
  longitude?: unknown;
  paste?: unknown;
}): { ok: true; latitude: number | null; longitude: number | null } | { ok: false; error: string } {
  const pasted = parseLatLngPaste(String(input.paste ?? ""));
  const latitude = pasted?.latitude ?? parseCoordinateField(input.latitude);
  const longitude = pasted?.longitude ?? parseCoordinateField(input.longitude);

  const latRaw = String(input.latitude ?? "").trim();
  const lngRaw = String(input.longitude ?? "").trim();
  if (!pasted && latRaw && latitude == null) {
    return { ok: false, error: "Latitude must be a number (or paste both coordinates from Google Maps)." };
  }
  if (!pasted && lngRaw && longitude == null) {
    return { ok: false, error: "Longitude must be a number (or paste both coordinates from Google Maps)." };
  }
  if ((latitude == null) !== (longitude == null)) {
    return { ok: false, error: "Enter both latitude and longitude, or clear both." };
  }
  if (latitude != null && longitude != null && !isInNigeria(latitude, longitude)) {
    return {
      ok: false,
      error: "Those coordinates are outside Nigeria. Paste the Google Maps pin for this polling unit.",
    };
  }
  return { ok: true, latitude, longitude };
}
