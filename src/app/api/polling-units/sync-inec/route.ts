import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission } from "@/types/auth";
import { createServiceClient } from "@/lib/supabase/admin";
import { INEC_STATE_FILES } from "@/lib/polling-units/inec-register";
import { syncInecRegisterBatch } from "@/lib/polling-units/inec-sync";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(user.role, "polling_units.manage")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const supabase = createServiceClient();
  const { count } = await supabase
    .from("polling_units")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", user.profile.tenant_id);
  return NextResponse.json({
    success: true,
    puCount: count ?? 0,
    catalogStates: INEC_STATE_FILES.length,
    firstState: INEC_STATE_FILES[0]?.token ?? "FCT",
  });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(user.role, "polling_units.manage")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let state: string | undefined;
  let offset = 0;
  let limit = 400;
  try {
    const body = (await req.json()) as { state?: string; offset?: number; limit?: number };
    if (typeof body.state === "string" && body.state.trim()) state = body.state.trim();
    if (typeof body.offset === "number") offset = body.offset;
    if (typeof body.limit === "number") limit = body.limit;
  } catch {
    // empty body starts at FCT
  }

  try {
    const result = await syncInecRegisterBatch(createServiceClient(), user.profile.tenant_id, {
      state,
      offset,
      limit,
    });
    revalidatePath("/polling-units");
    revalidatePath("/polling-units/agents");
    revalidatePath("/maps");
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not sync INEC register";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
