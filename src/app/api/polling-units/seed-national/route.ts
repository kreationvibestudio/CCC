import { NextRequest, NextResponse } from "next/server";
import { authorize, requirePlatformOperator } from "@/lib/auth/session";
import { seedNationalPollingUnitsCatalog } from "@/lib/polling-units/seed-national";

/**
 * Seed / refresh the shared Nigeria PU catalog from the public INEC register.
 * Body: { states?: string[] } — optional subset (e.g. ["KANO","LAGOS"]).
 * One request processes every requested state (can take several minutes).
 */
export async function POST(req: NextRequest) {
  try {
    // Platform operators or HQ PU managers may refresh the shared catalog.
    let allowed = false;
    try {
      await requirePlatformOperator();
      allowed = true;
    } catch {
      const gate = await authorize("polling_units.manage", "admin.users");
      allowed = gate.ok;
    }
    if (!allowed) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let states: string[] | undefined;
    try {
      const body = (await req.json()) as { states?: string[] };
      if (Array.isArray(body.states) && body.states.length) {
        states = body.states.map(String);
      }
    } catch {
      // empty body = all states
    }

    const result = await seedNationalPollingUnitsCatalog({ states });
    return NextResponse.json({
      success: true,
      ...result,
      errorSample: result.errors.slice(0, 5),
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Seed failed" },
      { status: 500 }
    );
  }
}
