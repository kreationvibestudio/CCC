/** Domain for Auth logins keyed by Nigerian mobile (11-digit local form). */
export const PHONE_AUTH_EMAIL_DOMAIN = "phone.ccc.local";

/**
 * Normalize to local Nigerian mobile `0XXXXXXXXXX` (11 digits).
 * Accepts 080…, 234…, +234…, and 10-digit without leading 0.
 */
export function normalizeNgMobile11(raw: string | null | undefined): string | null {
  const digits = String(raw ?? "").replace(/\D/g, "");
  if (!digits) return null;

  let local: string | null = null;
  if (digits.length === 11 && digits.startsWith("0")) {
    local = digits;
  } else if (digits.length === 13 && digits.startsWith("234")) {
    local = `0${digits.slice(3)}`;
  } else if (digits.length === 10 && /^[789]/.test(digits)) {
    local = `0${digits}`;
  }

  if (!local) return null;
  // Nigerian mobiles: 070/080/081/090/091…
  if (!/^0[789]\d{9}$/.test(local)) return null;
  return local;
}

export function phoneToAuthEmail(phone11: string): string {
  return `${phone11}@${PHONE_AUTH_EMAIL_DOMAIN}`;
}

export function authEmailToPhone(email: string | null | undefined): string | null {
  if (!email) return null;
  const match = email.trim().toLowerCase().match(/^(\d{11})@phone\.ccc\.local$/);
  if (!match) return null;
  return normalizeNgMobile11(match[1]);
}

export function isPhoneAuthEmail(email: string | null | undefined): boolean {
  return Boolean(authEmailToPhone(email));
}

/** Map a login username (email or 11-digit phone) to the Auth email Supabase expects. */
export function resolveLoginAuthEmail(identifier: string): string {
  const trimmed = identifier.trim();
  const phone = normalizeNgMobile11(trimmed);
  if (phone) return phoneToAuthEmail(phone);
  return trimmed.toLowerCase();
}
