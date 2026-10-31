import { LICENSE_GRACE_DAYS } from "./keys.ts";

export type LicenseStatus = "active" | "grace" | "expired" | "suspended" | "missing";

export type TenantLicenseInfo = {
  tenantId: string;
  licenseKey: string | null;
  status: LicenseStatus;
  startsAt: string | null;
  expiresAt: string | null;
  graceEndsAt: string | null;
  issuedToEmail: string | null;
  daysRemaining: number | null;
  msRemaining: number | null;
  allowsAccess: boolean;
  allowsWrite: boolean;
};

export function computeLicenseInfo(row: {
  tenant_id: string;
  license_key?: string | null;
  status?: string | null;
  starts_at?: string | null;
  expires_at?: string | null;
  grace_ends_at?: string | null;
  issued_to_email?: string | null;
} | null): TenantLicenseInfo {
  if (!row?.expires_at) {
    return {
      tenantId: row?.tenant_id ?? "",
      licenseKey: row?.license_key ?? null,
      status: "missing",
      startsAt: row?.starts_at ?? null,
      expiresAt: null,
      graceEndsAt: null,
      issuedToEmail: row?.issued_to_email ?? null,
      daysRemaining: null,
      msRemaining: null,
      allowsAccess: false,
      allowsWrite: false,
    };
  }

  const now = Date.now();
  const expiresAtMs = new Date(row.expires_at).getTime();
  const graceEndsAt =
    row.grace_ends_at ??
    new Date(expiresAtMs + LICENSE_GRACE_DAYS * 86_400_000).toISOString();
  const graceEndsMs = new Date(graceEndsAt).getTime();
  const msRemaining = expiresAtMs - now;
  const daysRemaining = Math.ceil(msRemaining / 86_400_000);

  let status: LicenseStatus = (row.status as LicenseStatus) || "active";
  if (row.status === "suspended") {
    status = "suspended";
  } else if (now > graceEndsMs) {
    status = "expired";
  } else if (now > expiresAtMs) {
    status = "grace";
  } else {
    status = "active";
  }

  const allowsAccess = status === "active" || status === "grace";
  const allowsWrite = status === "active";

  return {
    tenantId: row.tenant_id,
    licenseKey: row.license_key ?? null,
    status,
    startsAt: row.starts_at ?? null,
    expiresAt: row.expires_at,
    graceEndsAt,
    issuedToEmail: row.issued_to_email ?? null,
    daysRemaining,
    msRemaining,
    allowsAccess,
    allowsWrite,
  };
}

export function licenseStatusLabel(status: LicenseStatus): string {
  switch (status) {
    case "active":
      return "Active";
    case "grace":
      return "Grace period";
    case "expired":
      return "Expired";
    case "suspended":
      return "Suspended";
    default:
      return "No license";
  }
}
