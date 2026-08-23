import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { URL } from "node:url";
import type { UserRole } from "@/types/auth";

function authAdminConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return { url, key };
}

export function authUserIdFromBody(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const rec = body as Record<string, unknown>;
  if (typeof rec.id === "string" && rec.id.length > 8) return rec.id;
  const user = rec.user;
  if (user && typeof user === "object") {
    const id = (user as { id?: unknown }).id;
    if (typeof id === "string" && id.length > 8) return id;
  }
  return null;
}

export function parseGoTrueError(status: number, raw: string): string {
  let body: unknown = raw;
  try {
    body = raw ? JSON.parse(raw) : {};
  } catch {
    body = raw;
  }
  const msg =
    asNonEmptyString(body) ??
    (typeof raw === "string" && raw.trim() && raw.trim() !== "{}" ? raw.trim().slice(0, 240) : null) ??
    `Auth admin HTTP ${status}`;
  return `${msg} (${status})`;
}

function asNonEmptyString(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 && trimmed !== "{}" ? trimmed : null;
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    for (const key of ["msg", "message", "error_description", "error"] as const) {
      const nested = record[key];
      if (typeof nested === "string" && nested.trim() && nested.trim() !== "{}") {
        return nested.trim();
      }
    }
  }
  return null;
}

export function isAlreadyRegistered(status: number, message: string) {
  return status === 422 || /already (been )?registered|email_exists|already exists|duplicate/i.test(message);
}

export function isTriggerCreateError(status: number, message: string) {
  return status >= 500 || /database error creating new user|signup requires an invitation/i.test(message);
}

export function hqCreateUserBodies(input: {
  email: string;
  password: string;
  fullName: string;
  tenantId: string;
  role: UserRole;
}) {
  const tenantId = String(input.tenantId);
  const full_name = input.fullName;
  const role = input.role;
  return [
    {
      email: input.email,
      password: input.password,
      email_confirm: true,
      app_metadata: { tenant_id: tenantId, role, hq_invite: true },
      user_metadata: { full_name, tenant_id: tenantId, role },
    },
    {
      email: input.email,
      password: input.password,
      email_confirm: true,
      user_metadata: { full_name, tenant_id: tenantId },
    },
    {
      email: input.email,
      password: input.password,
      email_confirm: true,
      user_metadata: { full_name },
    },
  ];
}

type AdminHttpResult = { status: number; text: string };

/**
 * Call GoTrue with Node's http/https so Next.js Server Action fetch wrapping
 * (incoming cookies + fetch cache) cannot swallow the Auth admin response.
 */
export function authAdminHttp(
  target: string,
  init: { method: string; headers: Record<string, string>; body?: string }
): Promise<AdminHttpResult> {
  return new Promise((resolve, reject) => {
    const url = new URL(target);
    const lib = url.protocol === "https:" ? httpsRequest : httpRequest;
    const payload = init.body ?? "";
    const req = lib(
      {
        hostname: url.hostname,
        port: url.port || (url.protocol === "https:" ? 443 : 80),
        path: `${url.pathname}${url.search}`,
        method: init.method,
        headers: {
          ...init.headers,
          ...(payload ? { "Content-Length": Buffer.byteLength(payload) } : {}),
        },
        timeout: 20000,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
        res.on("end", () =>
          resolve({ status: res.statusCode ?? 0, text: Buffer.concat(chunks).toString("utf8") })
        );
      }
    );
    req.on("timeout", () => req.destroy(new Error("Auth admin request timed out")));
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function authAdminRequest(pathAndQuery: string, init: { method?: string; body?: unknown } = {}) {
  const cfg = authAdminConfig();
  if (!cfg) return null;
  const method = init.method ?? "GET";
  const payload = init.body === undefined ? undefined : JSON.stringify(init.body);
  const headers: Record<string, string> = {
    Authorization: `Bearer ${cfg.key}`,
    apikey: cfg.key,
    Accept: "application/json",
  };
  if (payload) headers["Content-Type"] = "application/json";
  return authAdminHttp(`${cfg.url}/auth/v1${pathAndQuery}`, { method, headers, body: payload });
}

function parseJson(raw: string): unknown {
  try {
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export async function findAuthUserIdByEmail(email: string): Promise<string | null> {
  const res = await authAdminRequest(`/admin/users?filter=${encodeURIComponent(email)}`);
  if (!res || !res.status || res.status >= 400) return null;
  const body = parseJson(res.text) as { users?: { id: string; email?: string }[] };
  const match = (body.users ?? []).find((user) => user.email?.toLowerCase() === email);
  return match?.id ?? null;
}

export async function adminCreateAuthUser(input: {
  email: string;
  password: string;
  fullName: string;
  tenantId: string;
  role: UserRole;
  inviteToken?: string;
}): Promise<{ userId?: string; created?: boolean; error?: string }> {
  if (!authAdminConfig()) return { error: "SUPABASE_SERVICE_ROLE_KEY is not configured" };

  const bodies = hqCreateUserBodies(input);
  let lastError = "Could not create login";

  for (const body of bodies) {
    let res: AdminHttpResult;
    try {
      const posted = await authAdminRequest("/admin/users", { method: "POST", body });
      if (!posted) return { error: "SUPABASE_SERVICE_ROLE_KEY is not configured" };
      res = posted;
    } catch (e) {
      lastError = e instanceof Error && e.message.trim() ? e.message.trim() : "Auth admin request failed";
      continue;
    }

    if (res.status >= 200 && res.status < 300) {
      const userId = authUserIdFromBody(parseJson(res.text)) ?? (await findAuthUserIdByEmail(input.email));
      if (!userId) return { error: "Auth created a login but did not return a user id" };
      return { userId, created: true };
    }

    const message = parseGoTrueError(res.status, res.text);
    if (isAlreadyRegistered(res.status, message)) {
      const userId = await findAuthUserIdByEmail(input.email);
      if (userId) return { userId, created: false };
    }
    lastError = message;
    if (!isTriggerCreateError(res.status, message)) return { error: message };
  }

  const existing = await findAuthUserIdByEmail(input.email);
  if (existing) return { userId: existing, created: false };
  return { error: lastError };
}
