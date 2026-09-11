export type TrainingVolunteer = {
  id: string;
  full_name: string;
  phone: string;
  email?: string | null;
  lga?: string | null;
  ward?: string | null;
  support_roles?: string[];
  training_status: string;
  deployment_ready?: boolean;
  training_code?: string | null;
  trained_at?: string | null;
};

function asString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

/** Map a volunteers row from `select("*")` so missing LMS columns do not blank the People list. */
export function toTrainingVolunteer(row: Record<string, unknown>): TrainingVolunteer | null {
  const id = asString(row.id);
  const fullName = asString(row.full_name);
  if (!id || !fullName) return null;
  const roles = Array.isArray(row.support_roles)
    ? row.support_roles.filter((role): role is string => typeof role === "string")
    : [];
  return {
    id,
    full_name: fullName,
    phone: asString(row.phone) ?? "",
    email: asString(row.email),
    lga: asString(row.lga),
    ward: asString(row.ward),
    support_roles: roles,
    training_status: asString(row.training_status) ?? "pending",
    deployment_ready: row.deployment_ready === true,
    training_code: asString(row.training_code),
    trained_at: asString(row.trained_at),
  };
}

export function isMissingColumnError(message: string | null | undefined): boolean {
  const text = (message ?? "").toLowerCase();
  return text.includes("does not exist") || text.includes("schema cache") || text.includes("could not find");
}
