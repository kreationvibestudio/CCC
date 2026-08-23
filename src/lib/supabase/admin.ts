import { createClient } from "@supabase/supabase-js";

function serviceFetch(input: RequestInfo | URL, init?: RequestInit) {
  const headers = new Headers(init?.headers);
  headers.delete("cookie");
  headers.delete("Cookie");
  return fetch(input, {
    ...init,
    headers,
    cache: "no-store",
  });
}

/**
 * Service-role Supabase client for privileged admin operations.
 * Server-only — never import this into client components.
 *
 * Uses a cookie-free, uncached fetch so Next.js Server Actions cannot attach
 * the HQ user's session cookie or reuse a cached Auth response.
 */
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured");
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: {
      headers: { Authorization: `Bearer ${key}` },
      fetch: serviceFetch,
    },
  });
}
