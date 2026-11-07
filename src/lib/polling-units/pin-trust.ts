import { isApproxStoredPin, loadInecGpsCatalogByCode, type InecGpsRow } from "./inec-cvr-gps.ts";

/** Pin sources that are precise enough for the 100 ft Field Agent fence. */
export const TRUSTED_PIN_SOURCES = ["inec_cvr", "manual"] as const;
export type TrustedPinSource = (typeof TRUSTED_PIN_SOURCES)[number];
export type PinSource = TrustedPinSource | "street_geocode" | "approx";

export type PinTrustRow = {
  code?: string | null;
  name?: string | null;
  ward?: string | null;
  lga?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  pin_source?: string | null;
};

const MATCH_EPS = 1e-5;

export function isTrustedPinSource(source: string | null | undefined): source is TrustedPinSource {
  return source === "inec_cvr" || source === "manual";
}

export function coordinatesMatchCatalog(
  latitude: number,
  longitude: number,
  catalog: Pick<InecGpsRow, "latitude" | "longitude">
) {
  return (
    Math.abs(latitude - catalog.latitude) < MATCH_EPS &&
    Math.abs(longitude - catalog.longitude) < MATCH_EPS
  );
}

/**
 * Whether this pin is safe for agent GPS check-in.
 *
 * Trusted: explicit INEC CVR / HQ manual paste, or (legacy) coordinates that
 * still match the official INEC CVR catalog CSV within ~1 metre.
 * Rejected: approx LGA centroids, street geocode guesses, empty pins.
 */
export function isTrustedAgentPin(
  row: PinTrustRow,
  catalogByCode: Map<string, InecGpsRow> = loadInecGpsCatalogByCode()
): boolean {
  if (row.latitude == null || row.longitude == null) return false;
  const lat = Number(row.latitude);
  const lng = Number(row.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;

  if (isTrustedPinSource(row.pin_source)) return true;
  if (row.pin_source === "approx" || row.pin_source === "street_geocode") return false;
  if (isApproxStoredPin(row)) return false;

  const code = String(row.code ?? "").trim().toUpperCase();
  if (!code) return false;
  const catalog = catalogByCode.get(code);
  if (!catalog) return false;
  return coordinatesMatchCatalog(lat, lng, catalog);
}

export function agentPinTrustError(row: PinTrustRow): string {
  if (row.latitude == null || row.longitude == null) {
    return "This polling unit has no map pin. Ask HQ to Align to INEC GPS (or paste Google coordinates from the real building).";
  }
  if (row.pin_source === "approx" || isApproxStoredPin(row)) {
    return "This polling unit still has an approximate LGA pin (kilometres off). Ask HQ to Align to INEC GPS before Field Agents can sign in.";
  }
  if (row.pin_source === "street_geocode") {
    return "This polling unit pin came from street geocoding, not INEC survey GPS. Ask HQ to Align to INEC GPS or paste the exact Google Maps pin.";
  }
  return "This polling unit pin is not verified against INEC CVR GPS. Ask HQ to Align to INEC GPS (Polling units → Align to INEC GPS) or paste exact coordinates.";
}
