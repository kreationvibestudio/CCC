"use server";

import { getCurrentUser } from "@/lib/auth/session";
import { denyCreateIfRestricted, hasPermission, type UserRole } from "@/types/auth";
import {
  normalizeNin,
  photoDataUrl,
  sanitizeNinVerificationForStorage,
  splitPersonName,
  toVerifyMeDob,
  verifyMeConfigured,
  verifyMeDemoModeEnabled,
  verifyNinIdentity,
  type VerifyMeNinMatch,
} from "@/lib/integrations/verifyme/client";

function canStaffAgents(role: UserRole) {
  return hasPermission(role, "polling_units.manage") || hasPermission(role, "admin.users");
}

export type NinVerificationPreview = {
  nin: string;
  firstname: string;
  lastname: string;
  middlename?: string | null;
  phone?: string | null;
  gender?: string | null;
  birthdate?: string | null;
  photoUrl?: string | null;
  fieldMatches?: VerifyMeNinMatch["fieldMatches"];
  storage: Record<string, unknown>;
  demo?: boolean;
};

export async function getVerifyMeStatus(): Promise<{
  configured: boolean;
  demoMode: boolean;
}> {
  const user = await getCurrentUser();
  if (!user || !canStaffAgents(user.role)) {
    return { configured: false, demoMode: false };
  }
  return {
    configured: verifyMeConfigured(),
    demoMode: verifyMeDemoModeEnabled(),
  };
}

export async function verifyAgentNin(input: {
  nin: string;
  fullName: string;
  dateOfBirth: string;
}): Promise<{
  error?: string;
  verified?: boolean;
  preview?: NinVerificationPreview;
}> {
  const user = await getCurrentUser();
  if (!user || !canStaffAgents(user.role)) return { error: "Unauthorized" };
  const blocked = denyCreateIfRestricted(user.role);
  if (blocked) return { error: blocked };

  const nin = normalizeNin(input.nin);
  if (!nin) return { error: "NIN must be 11 digits" };
  if (!toVerifyMeDob(input.dateOfBirth)) {
    return { error: "Enter a valid date of birth before verifying NIN" };
  }
  const { firstname, lastname } = splitPersonName(input.fullName);
  if (firstname.length < 1) return { error: "Enter the agent full name before verifying NIN" };

  const result = await verifyNinIdentity({
    nin,
    firstname,
    lastname,
    dob: input.dateOfBirth,
  });
  if (!result.ok || !result.data) {
    return { error: result.error ?? "NIN verification failed", verified: false };
  }

  const storage = sanitizeNinVerificationForStorage(result.data, { demo: result.demo });
  const storedPhoto =
    typeof storage.photo === "string" ? photoDataUrl(storage.photo) : null;
  return {
    verified: true,
    preview: {
      nin: result.data.nin,
      firstname: result.data.firstname,
      lastname: result.data.lastname,
      middlename: result.data.middlename,
      phone: result.data.phone,
      gender: result.data.gender,
      birthdate: result.data.birthdate,
      photoUrl: photoDataUrl(result.data.photo) ?? storedPhoto,
      fieldMatches: result.data.fieldMatches,
      storage,
      demo: result.demo,
    },
  };
}
