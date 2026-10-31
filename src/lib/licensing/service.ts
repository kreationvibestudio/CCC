import { createServiceClient } from "@/lib/supabase/admin";
import { isMissingRelationError } from "@/lib/public-error";
import {
  LICENSE_GRACE_DAYS,
  LICENSE_TERM_DAYS,
  annualLicenseAmountNaira,
  generateLicenseKey,
  normalizeLicenseKey,
} from "./keys";
import { computeLicenseInfo, type TenantLicenseInfo } from "./status";
import { sendLicenseCopyEmail } from "./email";

function addDays(from: Date, days: number) {
  return new Date(from.getTime() + days * 86_400_000);
}

export async function getTenantLicense(tenantId: string): Promise<TenantLicenseInfo | null> {
  const admin = createServiceClient();
  const { data, error } = await admin
    .from("tenant_licenses")
    .select(
      "tenant_id, license_key, status, starts_at, expires_at, grace_ends_at, issued_to_email"
    )
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (error) {
    if (isMissingRelationError(error.message, "tenant_licenses")) return null;
    throw new Error(error.message);
  }
  return computeLicenseInfo(data);
}

export async function issueAvailableLicenseKeys(input: {
  count: number;
  createdBy?: string | null;
  notes?: string;
  amountNaira?: number;
}): Promise<{ error?: string; keys?: string[] }> {
  const count = Math.max(1, Math.min(50, Math.floor(input.count)));
  const admin = createServiceClient();
  const amount = input.amountNaira ?? annualLicenseAmountNaira();
  const rows = Array.from({ length: count }, () => ({
    license_key: generateLicenseKey(),
    status: "available",
    term_days: LICENSE_TERM_DAYS,
    amount_naira: amount,
    notes: input.notes?.trim() || null,
    created_by: input.createdBy ?? null,
  }));

  const { data, error } = await admin.from("license_keys").insert(rows).select("license_key");
  if (error) {
    if (isMissingRelationError(error.message, "license_keys")) {
      return { error: "License tables are missing. Run the licensing SQL migration." };
    }
    return { error: error.message };
  }
  return { keys: (data ?? []).map((r) => String(r.license_key)) };
}

/** Redeem an available key onto a workspace (create or activate). */
export async function redeemLicenseKeyForTenant(input: {
  tenantId: string;
  licenseKey: string;
  issuedToEmail?: string | null;
  issuedToName?: string | null;
  sendEmail?: boolean;
}): Promise<{ error?: string; license?: TenantLicenseInfo }> {
  const key = normalizeLicenseKey(input.licenseKey);
  if (!key.startsWith("CCC-") || key.length < 19) {
    return { error: "Enter a valid CCC license key" };
  }

  const admin = createServiceClient();
  const { data: inventory, error: findError } = await admin
    .from("license_keys")
    .select("id, license_key, status, term_days, amount_naira, currency")
    .eq("license_key", key)
    .maybeSingle();

  if (findError) {
    if (isMissingRelationError(findError.message, "license_keys")) {
      return { error: "License tables are missing. Run the licensing SQL migration." };
    }
    return { error: findError.message };
  }
  if (!inventory) return { error: "License key not found" };
  if (inventory.status === "revoked") return { error: "This license key has been revoked" };
  if (inventory.status === "redeemed") {
    const { data: existing } = await admin
      .from("tenant_licenses")
      .select("tenant_id")
      .eq("license_key", key)
      .maybeSingle();
    if (existing && existing.tenant_id !== input.tenantId) {
      return { error: "This license key is already used by another workspace" };
    }
  }

  const now = new Date();
  const termDays = Number(inventory.term_days) || LICENSE_TERM_DAYS;
  const expiresAt = addDays(now, termDays);
  const graceEndsAt = addDays(expiresAt, LICENSE_GRACE_DAYS);

  const licensePayload = {
    tenant_id: input.tenantId,
    license_key: key,
    status: "active",
    starts_at: now.toISOString(),
    expires_at: expiresAt.toISOString(),
    grace_ends_at: graceEndsAt.toISOString(),
    amount_naira: inventory.amount_naira,
    currency: inventory.currency || "NGN",
    issued_to_email: input.issuedToEmail?.trim().toLowerCase() || null,
    issued_to_name: input.issuedToName?.trim() || null,
    updated_at: now.toISOString(),
  };

  const { error: upsertError } = await admin
    .from("tenant_licenses")
    .upsert(licensePayload, { onConflict: "tenant_id" });
  if (upsertError) return { error: upsertError.message };

  await admin
    .from("license_keys")
    .update({
      status: "redeemed",
      redeemed_tenant_id: input.tenantId,
      redeemed_at: now.toISOString(),
    })
    .eq("id", inventory.id);

  const license = await getTenantLicense(input.tenantId);
  if (input.sendEmail && input.issuedToEmail && license?.licenseKey) {
    await sendLicenseCopyEmail({
      to: input.issuedToEmail,
      name: input.issuedToName || "Campaign Admin",
      licenseKey: license.licenseKey,
      expiresAt: license.expiresAt,
    });
  }
  return { license: license ?? undefined };
}

/** Extend entitlement after successful Paystack renewal; issues a fresh key copy. */
export async function applyLicenseRenewalPayment(input: {
  tenantId: string;
  reference: string;
  amountNaira: number;
  payerEmail: string;
  payerName?: string | null;
  channel?: string | null;
}): Promise<{ error?: string; license?: TenantLicenseInfo; licenseKey?: string }> {
  const admin = createServiceClient();
  const { data: existingPay } = await admin
    .from("tenant_license_payments")
    .select("id")
    .eq("tenant_id", input.tenantId)
    .eq("payment_reference", input.reference)
    .maybeSingle();
  if (existingPay) {
    const license = await getTenantLicense(input.tenantId);
    return { license: license ?? undefined, licenseKey: license?.licenseKey ?? undefined };
  }

  const current = await getTenantLicense(input.tenantId);
  const now = new Date();
  const base =
    current?.expiresAt && new Date(current.expiresAt).getTime() > now.getTime()
      ? new Date(current.expiresAt)
      : now;
  const periodStart = base;
  const periodEnd = addDays(base, LICENSE_TERM_DAYS);
  const graceEndsAt = addDays(periodEnd, LICENSE_GRACE_DAYS);
  const newKey = generateLicenseKey();

  await admin.from("license_keys").insert({
    license_key: newKey,
    status: "redeemed",
    term_days: LICENSE_TERM_DAYS,
    amount_naira: input.amountNaira,
    redeemed_tenant_id: input.tenantId,
    redeemed_at: now.toISOString(),
    notes: `Renewal ${input.reference}`,
  });

  const { data: licenseRow, error: licenseError } = await admin
    .from("tenant_licenses")
    .upsert(
      {
        tenant_id: input.tenantId,
        license_key: newKey,
        status: "active",
        starts_at: current?.startsAt && current.status !== "missing" ? current.startsAt : now.toISOString(),
        expires_at: periodEnd.toISOString(),
        grace_ends_at: graceEndsAt.toISOString(),
        amount_naira: input.amountNaira,
        currency: "NGN",
        issued_to_email: input.payerEmail.trim().toLowerCase(),
        issued_to_name: input.payerName?.trim() || null,
        last_payment_reference: input.reference,
        updated_at: now.toISOString(),
      },
      { onConflict: "tenant_id" }
    )
    .select("id")
    .maybeSingle();
  if (licenseError) return { error: licenseError.message };

  const { error: payError } = await admin.from("tenant_license_payments").insert({
    tenant_id: input.tenantId,
    license_id: licenseRow?.id ?? null,
    amount: input.amountNaira,
    currency: "NGN",
    payment_method: input.channel ? `paystack_${input.channel}` : "paystack",
    payment_reference: input.reference,
    period_start: periodStart.toISOString(),
    period_end: periodEnd.toISOString(),
    payer_email: input.payerEmail.trim().toLowerCase(),
    license_key_issued: newKey,
    raw_metadata: { purpose: "tenant_license" },
  });
  if (payError && !/duplicate|unique/i.test(payError.message)) {
    return { error: payError.message };
  }

  await sendLicenseCopyEmail({
    to: input.payerEmail,
    name: input.payerName || "Campaign Admin",
    licenseKey: newKey,
    expiresAt: periodEnd.toISOString(),
  });

  const license = await getTenantLicense(input.tenantId);
  return { license: license ?? undefined, licenseKey: newKey };
}
