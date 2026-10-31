"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser, requirePlatformOperator, authorize } from "@/lib/auth/session";
import { createServiceClient } from "@/lib/supabase/admin";
import { appBaseUrl } from "@/lib/campaign";
import { initializePaystackTransaction, paystackSecretKey } from "@/lib/integrations/paystack/client";
import { annualLicenseAmountNaira } from "./keys";
import { getTenantLicense, issueAvailableLicenseKeys, redeemLicenseKeyForTenant } from "./service";
import type { TenantLicenseInfo } from "./status";

export async function getCurrentWorkspaceLicense(): Promise<TenantLicenseInfo | null> {
  const user = await getCurrentUser();
  if (!user?.profile.tenant_id) return null;
  try {
    return await getTenantLicense(user.profile.tenant_id);
  } catch {
    return null;
  }
}

export async function activateWorkspaceLicense(formData: FormData) {
  const gate = await authorize("admin.users");
  if (!gate.ok) return { error: gate.error };
  const key = String(formData.get("license_key") ?? "");
  const result = await redeemLicenseKeyForTenant({
    tenantId: gate.user.profile.tenant_id,
    licenseKey: key,
    issuedToEmail: gate.user.email,
    issuedToName: gate.user.profile.full_name,
    sendEmail: true,
  });
  if (result.error) return { error: result.error };
  revalidatePath("/admin");
  revalidatePath("/");
  return { success: true as const, license: result.license };
}

export async function startLicenseRenewalCheckout(): Promise<
  { error: string } | { authorizationUrl: string; amountNaira: number }
> {
  const gate = await authorize("admin.users");
  if (!gate.ok) return { error: gate.error };
  if (!paystackSecretKey()) {
    return { error: "Paystack is not configured. Set PAYSTACK_SECRET_KEY to accept renewals." };
  }
  const base = appBaseUrl();
  if (!base) return { error: "NEXT_PUBLIC_APP_URL is not set" };

  const amountNaira = annualLicenseAmountNaira();
  const started = await initializePaystackTransaction({
    email: gate.user.email,
    amountNaira,
    callbackUrl: `${base}/license/success`,
    metadata: {
      purpose: "tenant_license",
      tenant_id: gate.user.profile.tenant_id,
      tenant_slug: gate.user.workspace?.slug,
      full_name: gate.user.profile.full_name,
    },
  });
  if ("error" in started) return { error: started.error };
  return { authorizationUrl: started.data.authorization_url, amountNaira };
}

export async function generatePlatformLicenseKeys(formData: FormData) {
  try {
    const operator = await requirePlatformOperator();
    const count = Number(formData.get("count") ?? 1);
    const notes = String(formData.get("notes") ?? "").trim();
    const result = await issueAvailableLicenseKeys({
      count,
      createdBy: operator.id,
      notes: notes || `Issued by ${operator.email}`,
    });
    if (result.error) return { error: result.error };
    revalidatePath("/platform");
    return { success: true as const, keys: result.keys ?? [] };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not generate keys" };
  }
}

export async function listAvailableLicenseKeys(limit = 20) {
  await requirePlatformOperator();
  const admin = createServiceClient();
  const { data, error } = await admin
    .from("license_keys")
    .select("license_key, status, created_at, amount_naira")
    .eq("status", "available")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    return { error: error.message, keys: [] as Array<{ license_key: string; created_at: string }> };
  }
  return { keys: data ?? [] };
}
