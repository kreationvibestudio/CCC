import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission } from "@/types/auth";
import { createServiceClient } from "@/lib/supabase/admin";
import { countPollingUnitPins, fillApproxPinsForTenant, geocodeBatchLimit, geocodePendingForTenant } from "@/lib/polling-units/geocode-batch";

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
  let approx = false;
  let limit: number | undefined;
  try {
    const body = (await req.json()) as { retryFailed?: boolean; limit?: number; approx?: boolean };
    retryFailed = Boolean(body.retryFailed);
    approx = Boolean(body.approx);
    if (typeof body.limit === "number") limit = body.limit;
  } catch {
    // empty body is fine
  }

  const supabase = createServiceClient();
  const result = approx
    ? await fillApproxPinsForTenant(supabase, user.profile.tenant_id, { limit: limit ?? 500 }).then((r) => ({
        processed: r.updated,
        geocoded: r.updated,
        failed: 0,
        remaining: r.remaining,
        mapped: r.mapped,
        total: r.total,
        provider: "approx" as const,
        samples: [],
      }))
    : await geocodePendingForTenant(supabase, user.profile.tenant_id, {
        retryFailed,
        limit: limit ?? geocodeBatchLimit(),
      });

  revalidatePath("/polling-units");
  revalidatePath("/polling-units/agents");
  revalidatePath("/maps");

  return NextResponse.json({ success: true, ...result });
}
