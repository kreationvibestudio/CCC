import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission } from "@/types/auth";
import { createServiceClient } from "@/lib/supabase/admin";
import { normalizePollingUnitCodes } from "@/lib/polling-units/normalize-codes";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(user.role, "polling_units.manage")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let limit = 200;
  try {
    const body = (await req.json()) as { limit?: number };
    if (typeof body.limit === "number") limit = body.limit;
  } catch {
    // empty body is fine
  }

  const result = await normalizePollingUnitCodes(createServiceClient(), user.profile.tenant_id, limit);
  revalidatePath("/polling-units");
  revalidatePath("/polling-units/agents");
  revalidatePath("/maps");
  return NextResponse.json({ success: true, ...result });
}
