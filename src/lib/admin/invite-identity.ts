import { randomBytes } from "crypto";

/** Domain for Auth logins when HQ invites someone without an email. */
export const SYNTHETIC_INVITE_EMAIL_DOMAIN = "users.ccc.local";

export function isSyntheticInviteEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return email.trim().toLowerCase().endsWith(`@${SYNTHETIC_INVITE_EMAIL_DOMAIN}`);
}

export function newSyntheticInviteEmail(): string {
  return `u${randomBytes(8).toString("hex")}@${SYNTHETIC_INVITE_EMAIL_DOMAIN}`;
}

/**
 * Resolve invite identity: email is optional. When omitted, Auth still needs a
 * unique address, so we mint a private @users.ccc.local login id.
 */
export function resolveInviteIdentity(input: {
  email?: string | null;
  fullName?: string | null;
}):
  | { error: string }
  | { email: string; fullName: string; emailProvided: boolean } {
  const rawEmail = String(input.email ?? "").trim().toLowerCase();
  const fullName = String(input.fullName ?? "").trim();

  if (rawEmail) {
    if (!rawEmail.includes("@") || rawEmail.startsWith("@") || rawEmail.endsWith("@")) {
      return { error: "Enter a valid email, or leave it blank" };
    }
    return {
      email: rawEmail,
      fullName: fullName || rawEmail.split("@")[0] || "Team member",
      emailProvided: true,
    };
  }

  if (!fullName) {
    return { error: "Full name is required when email is blank" };
  }

  return {
    email: newSyntheticInviteEmail(),
    fullName,
    emailProvided: false,
  };
}
