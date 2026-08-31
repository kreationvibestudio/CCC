/** Earth-surface distance in metres. */
export function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number) {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(a));
}

/** Field GPS is noisy and map pins are often approximate; 5 km covers the PU area without opening the whole LGA. */
export const AGENT_LOGIN_RADIUS_M = 5000;

export function isWithinAgentLoginRadius(distanceM: number) {
  return Number.isFinite(distanceM) && distanceM <= AGENT_LOGIN_RADIUS_M;
}

/** When true (default), agents can sign in with code alone if GPS is unavailable. */
export function isAgentSoftGpsEnabled() {
  const flag = process.env.AGENT_LOGIN_SOFT_GPS?.trim().toLowerCase();
  if (flag === "0" || flag === "false" || flag === "off") return false;
  return true;
}
