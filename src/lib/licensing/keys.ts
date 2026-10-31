import { randomBytes } from "crypto";

/** Human-readable annual license key, e.g. CCC-AB12-CD34-EF56-GH78 */
export function generateLicenseKey(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(16);
  const chars: string[] = [];
  for (let i = 0; i < 16; i += 1) {
    chars.push(alphabet[bytes[i]! % alphabet.length]!);
  }
  return `CCC-${chars.slice(0, 4).join("")}-${chars.slice(4, 8).join("")}-${chars.slice(8, 12).join("")}-${chars.slice(12, 16).join("")}`;
}

export function normalizeLicenseKey(raw: string): string {
  return raw
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function annualLicenseAmountNaira(): number {
  const raw = Number(process.env.CCC_LICENSE_ANNUAL_AMOUNT_NAIRA ?? "500000");
  if (!Number.isFinite(raw) || raw < 1000) return 500_000;
  return Math.round(raw);
}

export const LICENSE_TERM_DAYS = 365;
export const LICENSE_GRACE_DAYS = 7;
