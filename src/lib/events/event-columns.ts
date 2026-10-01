import { isMissingColumnError } from "../public-error.ts";

/** LMS columns added in 20260910120000 — older cloud DBs may not have them yet. */
export const OPTIONAL_EVENT_LMS_COLUMNS = ["requires_trained", "required_role_slug"] as const;

/**
 * Drop unmigrated LMS fields so event create/update still works on older schemas.
 * When any optional LMS column is missing, omit all of them in one retry.
 */
export function omitUnmigratedEventColumns(
  payload: Record<string, unknown>,
  errorMessage: string
): Record<string, unknown> | null {
  const touchesLms = OPTIONAL_EVENT_LMS_COLUMNS.some(
    (col) => col in payload && isMissingColumnError(errorMessage, col)
  );
  if (!touchesLms) return null;

  const next = { ...payload };
  for (const col of OPTIONAL_EVENT_LMS_COLUMNS) {
    delete next[col];
  }
  return next;
}

/** Convert datetime-local (or ISO) form values to a timestamptz ISO string. */
export function formDateTimeToIso(value: FormDataEntryValue | null): string | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}
