/** Plain-text block for WhatsApp / SMS after an HQ invite. */
export function formatInviteCredentials(input: {
  username: string;
  password: string;
  loginUrl: string;
}): string {
  return [
    `Username: ${input.username}`,
    `Temporary password: ${input.password}`,
    `Login: ${input.loginUrl}`,
  ].join("\n");
}

export type InviteCredentials = {
  username: string;
  password: string;
  loginUrl: string;
};

/** Survives AdminView remount when router.refresh() updates the team list. */
export const INVITE_CREDENTIALS_STORAGE_KEY = "ccc.admin.inviteCredentials";

export function parseInviteCredentials(raw: unknown): InviteCredentials | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const username = typeof row.username === "string" ? row.username.trim() : "";
  const password = typeof row.password === "string" ? row.password : "";
  const loginUrl = typeof row.loginUrl === "string" ? row.loginUrl.trim() : "";
  if (!username || !password) return null;
  return { username, password, loginUrl: loginUrl || "/login" };
}

export function readStoredInviteCredentials(
  storage: Pick<Storage, "getItem"> | null | undefined = typeof sessionStorage !== "undefined"
    ? sessionStorage
    : null
): InviteCredentials | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(INVITE_CREDENTIALS_STORAGE_KEY);
    if (!raw) return null;
    return parseInviteCredentials(JSON.parse(raw) as unknown);
  } catch {
    return null;
  }
}

export function writeStoredInviteCredentials(
  creds: InviteCredentials,
  storage: Pick<Storage, "setItem"> | null | undefined = typeof sessionStorage !== "undefined"
    ? sessionStorage
    : null
): void {
  if (!storage) return;
  try {
    storage.setItem(INVITE_CREDENTIALS_STORAGE_KEY, JSON.stringify(creds));
  } catch {
    /* private mode / quota */
  }
}

export function clearStoredInviteCredentials(
  storage: Pick<Storage, "removeItem"> | null | undefined = typeof sessionStorage !== "undefined"
    ? sessionStorage
    : null
): void {
  if (!storage) return;
  try {
    storage.removeItem(INVITE_CREDENTIALS_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function resolvePublicLoginUrl(fromServer?: string | null, origin?: string | null): string {
  if (fromServer?.trim()) return fromServer.trim().replace(/\/$/, "");
  const host = (origin ?? "").trim().replace(/\/$/, "");
  if (host) return `${host}/login`;
  return "/login";
}
