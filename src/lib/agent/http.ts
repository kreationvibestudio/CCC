import { NextResponse } from "next/server";
import { getCurrentUser, type AuthUser } from "@/lib/auth/session";
import { hasPermission } from "@/types/auth";

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
    if (!hasPermission(user.role, "agent.portal")) {
      return jsonError(403, "This account cannot use the Agent Portal");
    }
    return user;
  } catch {
    return jsonError(401, "Unauthorized");
  }
}

export function isResponse(value: AuthUser | NextResponse): value is NextResponse {
  return value instanceof NextResponse;
}
