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
import { applyInecGpsForTenant } from "@/lib/polling-units/inec-cvr-gps";

export const runtime = "nodejs";
export const maxDuration = 60;

function canManagePins(role: Parameters<typeof hasPermission>[0], mode: "approx" | "inec" | "street") {
  if (hasPermission(role, "polling_units.manage")) return true;
  // Approx + INEC GPS alignment are HQ map ops.
  if ((mode === "approx" || mode === "inec") && hasPermission(role, "maps.view")) return true;
  return false;
}

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!canManagePins(user.role, "approx")) {
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
    let inec = false;
    let force = false;
    let limit: number | undefined;
    let offset = 0;
    try {
      const body = (await req.json()) as {
        retryFailed?: boolean;
        limit?: number;
        approx?: boolean;
        inec?: boolean;
        force?: boolean;
        offset?: number;
      };
      retryFailed = Boolean(body.retryFailed);
      approx = Boolean(body.approx);
      inec = Boolean(body.inec);
      force = Boolean(body.force);
      if (typeof body.limit === "number") limit = body.limit;
      if (typeof body.offset === "number" && Number.isFinite(body.offset)) {
        offset = Math.max(0, Math.floor(body.offset));
      }
    } catch {
      // empty body is fine
    }

    const mode = inec ? "inec" : approx ? "approx" : "street";
    if (!canManagePins(user.role, mode)) {
      return NextResponse.json(
        {
          error:
            mode === "street"
              ? "Forbidden — need Polling Units manage permission for street geocoding"
              : "Forbidden — sign in with a role that can view Maps",
        },
        { status: 403 }
      );
    }

    const supabase = createServiceClient();
    const result = inec
      ? await applyInecGpsForTenant(supabase, user.profile.tenant_id, {
          limit: limit ?? 250,
          force: force || true,
          offset,
        }).then((r) => ({
          processed: r.updated + r.skipped + r.missing,
          geocoded: r.updated,
          failed: r.errors.length,
          remaining: Math.max(r.catalog - r.nextOffset, 0),
          remainingApprox: r.remainingApprox,
          mapped: r.mapped,
          total: r.total,
          provider: "inec_cvr" as const,
          catalog: r.catalog,
          nextOffset: r.nextOffset,
          samples: r.samples,
          errors: r.errors,
        }))
      : approx
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
