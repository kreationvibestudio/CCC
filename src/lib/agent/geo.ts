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

export const FEET_PER_METER = 3.280839895;

/** HQ rule: the agent must be on the unit grounds — 100 ft in any direction. */
export const AGENT_LOGIN_RADIUS_FT = 100;

/** 100 feet, in metres. Phone GPS is noisy; this is still a tight on-site fence. */
export const AGENT_LOGIN_RADIUS_M = AGENT_LOGIN_RADIUS_FT / FEET_PER_METER;

export function metersToFeet(meters: number) {
  return meters * FEET_PER_METER;
}

export function formatLoginDistance(meters: number) {
  const feet = Math.round(metersToFeet(meters));
  return `${feet} ft`;
}

export function isWithinAgentLoginRadius(distanceM: number) {
  return Number.isFinite(distanceM) && distanceM <= AGENT_LOGIN_RADIUS_M;
}

/**
 * Soft check-in (code only, no GPS) is opt-in for labs.
 * Production must send a location that matches the unit pin.
 */
export function isAgentSoftGpsEnabled() {
  const flag = process.env.AGENT_LOGIN_SOFT_GPS?.trim().toLowerCase();
  return flag === "1" || flag === "true" || flag === "on";
}
