import { isMissingColumnError } from "../public-error.ts";

/**
 * Drop columns the live database has not migrated yet.
 *
 * HQ must still be able to issue codes when only `expires_at` or
 * `code_display` is missing. Returning a "run this SQL" error blocks the
 * field app for a schema drift the login path already tolerates.
 */
export function omitUnmigratedAgentCodeColumns(
  payload: Record<string, unknown>,
  errorMessage: string
): Record<string, unknown> | null {
  const next = { ...payload };
  let changed = false;
  if ("expires_at" in next && isMissingColumnError(errorMessage, "expires_at")) {
    delete next.expires_at;
    changed = true;
  }
  if ("code_display" in next && isMissingColumnError(errorMessage, "code_display")) {
    delete next.code_display;
    changed = true;
  }
  return changed ? next : null;
}
