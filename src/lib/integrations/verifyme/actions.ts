"use server";

import { getCurrentUser } from "@/lib/auth/session";
import { denyCreateIfRestricted, hasPermission, type UserRole } from "@/types/auth";
import {
  ninProviderStatus,
  verifyNinIdentityUnified,
  type NinMatch,
} from "@/lib/integrations/identity/nin";
import { normalizeNin, photoDataUrl, splitPersonName, toIsoDob } from "@/lib/integrations/verifyme/helpers";

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
  address?: string | null;
  photoUrl?: string | null;
  fieldMatches?: NinMatch["fieldMatches"];
  matchStatus?: string | null;
  storage: Record<string, unknown>;
  demo?: boolean;
  provider?: string;
};

export async function getVerifyMeStatus(): Promise<{
  configured: boolean;
  demoMode: boolean;
  provider: string;
}> {
  const user = await getCurrentUser();
  if (!user || !canStaffAgents(user.role)) {
    return { configured: false, demoMode: false, provider: "none" };
  }
  const status = ninProviderStatus();
  return {
    configured: status.configured,
    demoMode: status.demoMode,
    provider: status.provider,
  };
}

export async function verifyAgentNin(input: {
  nin: string;
  fullName: string;
  dateOfBirth: string;
  phone?: string;
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
  if (!toIsoDob(input.dateOfBirth)) {
    return { error: "Enter a valid date of birth before verifying NIN" };
  }
  const { firstname, lastname } = splitPersonName(input.fullName);
  if (firstname.length < 1) return { error: "Enter the agent full name before verifying NIN" };

  const result = await verifyNinIdentityUnified({
    nin,
    firstname,
    lastname,
    dob: input.dateOfBirth,
    phone: input.phone,
  });
  if (!result.ok || !result.data || !result.storage) {
    return { error: result.error ?? "NIN verification failed", verified: false };
  }

  const storedPhoto =
    typeof result.storage.photo === "string" ? photoDataUrl(result.storage.photo) : null;
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
      address: result.data.address ?? null,
      photoUrl: photoDataUrl(result.data.photo) ?? storedPhoto,
      fieldMatches: result.data.fieldMatches,
      matchStatus: result.data.matchStatus ?? null,
      storage: result.storage,
      demo: result.demo,
      provider: result.provider,
    },
  };
}
