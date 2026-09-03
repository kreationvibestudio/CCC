import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission } from "@/types/auth";
import { createServiceClient } from "@/lib/supabase/admin";
import {
  countPollingUnitPins,
  fillApproxPinsForTenant,
  geocodeBatchLimit,
  geocodePendingForTenant,
} from "@/lib/polling-units/geocode-batch";

export const runtime = "nodejs";
export const maxDuration = 60;

function canManagePins(role: Parameters<typeof hasPermission>[0], approx: boolean) {
  if (hasPermission(role, "polling_units.manage")) return true;
  // Approx pins are HQ ops for the map — allow anyone who can open Maps.
  if (approx && hasPermission(role, "maps.view")) return true;
  return false;
}

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!canManagePins(user.role, true)) {
      return NextResponse.json({ error: "Forbidden — need Maps or Polling Units access" }, { status: 403 });
    }
    const supabase = createServiceClient();
    const counts = await countPollingUnitPins(supabase, user.profile.tenant_id);
    return NextResponse.json({ success: true, ...counts });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Pin status check failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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

    if (!canManagePins(user.role, approx)) {
      return NextResponse.json(
        {
          error: approx
            ? "Forbidden — sign in with a role that can view Maps"
            : "Forbidden — need Polling Units manage permission for street geocoding",
        },
        { status: 403 }
      );
    }

    const supabase = createServiceClient();
    const result = approx
      ? await fillApproxPinsForTenant(supabase, user.profile.tenant_id, {
          limit: limit ?? 250,
        }).then((r) => ({
          processed: r.updated,
          geocoded: r.updated,
          failed: r.errors.length,
          remaining: r.remaining,
          mapped: r.mapped,
          total: r.total,
          provider: "approx" as const,
          samples: [],
          errors: r.errors,
        }))
      : await geocodePendingForTenant(supabase, user.profile.tenant_id, {
          retryFailed,
          limit: limit ?? geocodeBatchLimit(),
        });

    revalidatePath("/polling-units");
    revalidatePath("/polling-units/agents");
    revalidatePath("/maps");

    return NextResponse.json({ success: true, ...result });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Pin fill failed";
    console.error("[polling-units/geocode]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
