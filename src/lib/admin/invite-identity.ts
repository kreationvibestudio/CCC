import { randomBytes } from "crypto";
import {
  isPhoneAuthEmail,
  normalizeNgMobile11,
  phoneToAuthEmail,
  authEmailToPhone,
} from "../auth/phone-username.ts";

/** Domain for Auth logins when HQ invites someone without email or phone. */
export const SYNTHETIC_INVITE_EMAIL_DOMAIN = "users.ccc.local";

export function isSyntheticInviteEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return email.trim().toLowerCase().endsWith(`@${SYNTHETIC_INVITE_EMAIL_DOMAIN}`);
}

export function newSyntheticInviteEmail(): string {
  return `u${randomBytes(8).toString("hex")}@${SYNTHETIC_INVITE_EMAIL_DOMAIN}`;
}

export type InviteIdentity =
  | {
      email: string;
      fullName: string;
      phone: string | null;
      emailProvided: boolean;
      phoneProvided: boolean;
      /** What the person types on the sign-in screen (email or 11-digit phone). */
      loginUsername: string;
    }
  | { error: string };

/**
 * Resolve invite identity. Email and phone are both optional; at least a full
 * name is required when both are blank. Phone becomes the login username via
 * `{phone}@phone.ccc.local`.
 */
export function resolveInviteIdentity(input: {
  email?: string | null;
  phone?: string | null;
  fullName?: string | null;
}): InviteIdentity {
  const rawEmailOrPhone = String(input.email ?? "").trim();
  const rawPhoneField = String(input.phone ?? "").trim();
  const fullName = String(input.fullName ?? "").trim();

  const phoneFromField = normalizeNgMobile11(rawPhoneField);
  const phoneFromEmailBox = !rawEmailOrPhone.includes("@")
    ? normalizeNgMobile11(rawEmailOrPhone)
    : null;
  const phone = phoneFromField ?? phoneFromEmailBox;

  const looksLikeEmail = rawEmailOrPhone.includes("@");
  if (looksLikeEmail) {
    const email = rawEmailOrPhone.toLowerCase();
    if (email.startsWith("@") || email.endsWith("@") || email.split("@").length !== 2) {
      return { error: "Enter a valid email, an 11-digit phone, or leave blank" };
    }
    return {
      email,
      fullName: fullName || email.split("@")[0] || "Team member",
      phone: phoneFromField,
      emailProvided: true,
      phoneProvided: Boolean(phoneFromField),
      loginUsername: email,
    };
  }

  if (phone) {
    return {
      email: phoneToAuthEmail(phone),
      fullName: fullName || phone,
      phone,
      emailProvided: false,
      phoneProvided: true,
      loginUsername: phone,
    };
  }

  if (rawEmailOrPhone || rawPhoneField) {
    return {
      error: "Enter a valid email, an 11-digit Nigerian phone (e.g. 0813…), or leave blank",
    };
  }

  if (!fullName) {
    return { error: "Full name is required when email and phone are blank" };
  }

  const synthetic = newSyntheticInviteEmail();
  return {
    email: synthetic,
    fullName,
    phone: null,
    emailProvided: false,
    phoneProvided: false,
    loginUsername: synthetic,
  };
}

/** Human-readable login / email cell for the team list. */
export function displayInviteLogin(email: string | null | undefined): string {
  if (!email) return "—";
  const phone = authEmailToPhone(email);
  if (phone) return phone;
  if (isSyntheticInviteEmail(email)) return `No email · login ${email}`;
  return email;
}

export { isPhoneAuthEmail };
