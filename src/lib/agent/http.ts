import { NextResponse } from "next/server";
import { getCurrentUser, type AuthUser } from "@/lib/auth/session";
import { canAccessFieldAgentTools } from "@/lib/auth/also-field-agent";

export function jsonError(status: number, error: string) {
  return NextResponse.json({ error }, { status });
}

export function jsonOk(body: unknown, status = 200) {
  return NextResponse.json(body, { status });
}

export async function requireAgentApi(): Promise<AuthUser | NextResponse> {
  try {
    const user = await getCurrentUser();
    if (!user) return jsonError(401, "Unauthorized");
    if (!canAccessFieldAgentTools(user.role, user.profile.also_field_agent)) {
      return jsonError(403, "Sign in with a Field Agent login from HQ (PU Agents). HQ accounts stay on the web.");
    }
    return user;
  } catch {
    return jsonError(401, "Unauthorized");
  }
}

export function isResponse(value: AuthUser | NextResponse): value is NextResponse {
  return value instanceof NextResponse;
}
