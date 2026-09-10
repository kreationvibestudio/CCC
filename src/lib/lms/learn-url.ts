export function volunteerLearnLoginUrl(slug: string, base: string) {
  const host = base.trim().replace(/\/$/, "");
  const workspace = slug.trim().replace(/^\/+|\/+$/g, "");
  if (!host || !workspace) return "";
  return `${host}/learn/${workspace}/login`;
}

export function resolveAppHost(base = process.env.NEXT_PUBLIC_APP_URL ?? "") {
  const fromEnv = base.trim().replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  const vercel = (process.env.VERCEL_URL ?? "").trim().replace(/\/$/, "");
  return vercel ? `https://${vercel}` : "";
}
