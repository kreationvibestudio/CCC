/** Extract a Bearer token from an Authorization header. Returns null if missing or malformed. */
export function parseBearer(authorization: string | null | undefined): string | null {
  if (!authorization) return null;
  const match = /^Bearer\s+(\S+)/i.exec(authorization.trim());
  const token = match?.[1]?.trim() ?? "";
  if (token.length < 20) return null;
  if (token === "[SENSITIVE]") return null;
  return token;
}

/** Internal next-app paths only — blocks open redirects. */
export function safeInternalPath(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const path = raw.trim();
  if (!path.startsWith("/")) return null;
  if (path.startsWith("//") || path.startsWith("/\\")) return null;
  if (path.includes("://")) return null;
  if (path.includes("\\")) return null;
  return path;
}
