import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { safeInternalPath } from "@/lib/auth/bearer";

type CookieToSet = { name: string; value: string; options: CookieOptions };

export async function updateSession(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", request.nextUrl.pathname);

  let supabaseResponse = NextResponse.next({
    request: { headers: requestHeaders },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({
            request: { headers: requestHeaders },
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isResetPassword = path.startsWith("/reset-password");
  const isAuthRoute =
    path.startsWith("/login") ||
    path.startsWith("/register") ||
    path.startsWith("/forgot-password") ||
    isResetPassword;
  const isCheckInRoute = /^\/events\/[^/]+\/checkin/.test(path);
  const isDonateRoute = path.startsWith("/donate") || path.startsWith("/api/donations");
  const isJoinRoute = path.startsWith("/join");
  const isAgentApi = path.startsWith("/api/agent");
  const isPublicRoute =
    path === "/" || isAuthRoute || isCheckInRoute || isDonateRoute || isJoinRoute || isAgentApi;

  if (!user && !isPublicRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", path);
    return NextResponse.redirect(url);
  }

  if (user && isAuthRoute && !isResetPassword) {
    const url = request.nextUrl.clone();
    const next = safeInternalPath(request.nextUrl.searchParams.get("redirect")) ?? "/dashboard";
    const q = next.indexOf("?");
    url.pathname = q === -1 ? next : next.slice(0, q);
    url.search = q === -1 ? "" : next.slice(q);
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
