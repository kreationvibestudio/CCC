import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { safeInternalPath } from "@/lib/auth/bearer";
import { jsonUnauthorizedBody, wantsJsonUnauthorized } from "@/lib/auth/json-unauthorized";
import { mustChangePassword, passwordChangeAllowedPath } from "@/lib/auth/password";
import { buildCsp, allowsSameOriginFraming, frameOptionsForPath } from "@/lib/security/headers";

type CookieToSet = { name: string; value: string; options: CookieOptions };

export async function updateSession(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const path = request.nextUrl.pathname;
  const sameOriginFrames = allowsSameOriginFraming(path);
  const frameOptions = frameOptionsForPath(path);
  const csp = buildCsp({
    nonce,
    dev: process.env.NODE_ENV !== "production",
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    sameOriginFrames,
  });

  const stamp = (response: NextResponse) => {
    response.headers.set("content-security-policy", csp);
    response.headers.set("x-frame-options", frameOptions);
    return response;
  };

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", path);
  requestHeaders.set("x-nonce", nonce);
  // Next reads the nonce back out of the request-side CSP to stamp its own
  // <script> tags; without this the bootstrap chunk is blocked.
  requestHeaders.set("content-security-policy", csp);

  let supabaseResponse = stamp(
    NextResponse.next({
      request: { headers: requestHeaders },
    })
  );

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
          supabaseResponse = stamp(
            NextResponse.next({
              request: { headers: requestHeaders },
            })
          );
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

  const isResetPassword = path.startsWith("/reset-password");
  const isAuthRoute =
    path.startsWith("/login") ||
    path.startsWith("/register") ||
    path.startsWith("/forgot-password") ||
    isResetPassword;
  const isCheckInRoute = /^\/events\/[^/]+\/checkin/.test(path);
  const isDonateRoute = path.startsWith("/donate") || path.startsWith("/api/donations");
  const isVolunteerSignupRoute = path === "/volunteer" || path.startsWith("/volunteer/");
  const isLearnRoute = path === "/learn" || path.startsWith("/learn/");
  const isJoinRoute = path.startsWith("/join");
  const isAgentApi = path.startsWith("/api/agent");
  const isAgentCodeLogin = path === "/agent/login";
  const isPublicRoute =
    path === "/" ||
    isAuthRoute ||
    isCheckInRoute ||
    isDonateRoute ||
    isVolunteerSignupRoute ||
    isLearnRoute ||
    isJoinRoute ||
    isAgentApi ||
    isAgentCodeLogin;

  const redirectTo = (url: URL) => {
    const response = stamp(NextResponse.redirect(url));
    supabaseResponse.cookies.getAll().forEach((cookie) => response.cookies.set(cookie));
    return response;
  };

  if (!user && !isPublicRoute) {
    if (wantsJsonUnauthorized(path)) {
      const response = stamp(NextResponse.json(jsonUnauthorizedBody(), { status: 401 }));
      supabaseResponse.cookies.getAll().forEach((cookie) => response.cookies.set(cookie));
      return response;
    }
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", path);
    return redirectTo(url);
  }

  if (user && mustChangePassword(user) && !passwordChangeAllowedPath(path)) {
    if (wantsJsonUnauthorized(path)) {
      const response = stamp(
        NextResponse.json(
          { error: "Set a permanent password before using HQ" },
          { status: 403 }
        )
      );
      supabaseResponse.cookies.getAll().forEach((cookie) => response.cookies.set(cookie));
      return response;
    }
    const url = request.nextUrl.clone();
    url.pathname = "/change-password";
    url.search = "";
    return redirectTo(url);
  }

  if (user && isAuthRoute && !isResetPassword && !mustChangePassword(user)) {
    const url = request.nextUrl.clone();
    const next = safeInternalPath(request.nextUrl.searchParams.get("redirect")) ?? "/dashboard";
    const q = next.indexOf("?");
    url.pathname = q === -1 ? next : next.slice(0, q);
    url.search = q === -1 ? "" : next.slice(q);
    return redirectTo(url);
  }

  return supabaseResponse;
}
