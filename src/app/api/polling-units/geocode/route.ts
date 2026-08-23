import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission } from "@/types/auth";
import { createServiceClient } from "@/lib/supabase/admin";
import { countPollingUnitPins, geocodeBatchLimit, geocodePendingForTenant } from "@/lib/polling-units/geocode-batch";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(user.role, "polling_units.manage")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const supabase = createServiceClient();
  const counts = await countPollingUnitPins(supabase, user.profile.tenant_id);
  return NextResponse.json({ success: true, ...counts });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(user.role, "polling_units.manage")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let retryFailed = false;
  let limit: number | undefined;
  try {
    const body = (await req.json()) as { retryFailed?: boolean; limit?: number };
    retryFailed = Boolean(body.retryFailed);
    if (typeof body.limit === "number") limit = body.limit;
  } catch {
    // empty body is fine
  }

  const supabase = createServiceClient();
  const result = await geocodePendingForTenant(supabase, user.profile.tenant_id, {
    retryFailed,
    limit: limit ?? geocodeBatchLimit(),
  });

  revalidatePath("/polling-units");
  revalidatePath("/polling-units/agents");
  revalidatePath("/maps");

  return NextResponse.json({ success: true, ...result });
}
