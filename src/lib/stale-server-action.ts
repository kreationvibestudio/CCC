"use client";

/** Turbopack/HMR (and missing encryption keys) can leave the browser holding a dead Server Action id. */
export function isStaleServerAction(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /server action/i.test(message) && /not found/i.test(message);
}

export function recoverStaleServerAction(error: unknown) {
  if (!isStaleServerAction(error) || typeof window === "undefined") return false;
  window.location.reload();
  return true;
}
