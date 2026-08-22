import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies, headers } from "next/headers";
import { parseBearer } from "@/lib/auth/bearer";

type CookieToSet = { name: string; value: string; options: CookieOptions };

export async function createClient() {
  const cookieStore = await cookies();
  let authorization: string | null = null;
  try {
    authorization = (await headers()).get("authorization");
  } catch {
    authorization = null;
  }
  const bearer = parseBearer(authorization);

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server Component — ignore
          }
        },
      },
      ...(bearer
        ? { global: { headers: { Authorization: `Bearer ${bearer}` } } }
        : {}),
    }
  );
}
