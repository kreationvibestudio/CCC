/** API fetches must not receive an HTML login redirect. */
export function wantsJsonUnauthorized(pathname: string): boolean {
  return pathname.startsWith("/api/");
}

export function jsonUnauthorizedBody() {
  return { error: "Unauthorized" } as const;
}
