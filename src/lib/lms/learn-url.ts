export function volunteerLearnLoginUrl(slug: string, base: string) {
  const host = base.trim().replace(/\/$/, "");
  const workspace = slug.trim().replace(/^\/+|\/+$/g, "");
  if (!host || !workspace) return "";
  return `${host}/learn/${workspace}/login`;
}

export function resolveRequestHost(input: {
  forwardedProto?: string | null;
  forwardedHost?: string | null;
  host?: string | null;
} = {}) {
  const host = (input.forwardedHost || input.host || "").split(",")[0]?.trim() ?? "";
  if (!host) return "";
  const proto = (input.forwardedProto || "https").split(",")[0]?.trim() || "https";
  return `${proto}://${host}`.replace(/\/$/, "");
}

export function resolveAppHost(base = process.env.NEXT_PUBLIC_APP_URL ?? "", requestHost = "") {
  const fromEnv = base.trim().replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  const vercel = (process.env.VERCEL_URL ?? "").trim().replace(/\/$/, "");
  if (vercel) return vercel.startsWith("http") ? vercel : `https://${vercel}`;
  return requestHost.trim().replace(/\/$/, "");
}
