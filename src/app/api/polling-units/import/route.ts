import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { parsePollingUnitsCsv, type NormalizedPollingUnit } from "@/lib/polling-units/csv";
import { upsertPollingUnitRows } from "@/lib/polling-units/import-rows";

export const runtime = "nodejs";
export const maxDuration = 60;

const BATCH_LIMIT = 500;

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const contentType = req.headers.get("content-type") ?? "";
  let rows: NormalizedPollingUnit[] = [];

  if (contentType.includes("application/json")) {
    const body = (await req.json()) as { rows?: NormalizedPollingUnit[] };
    rows = body.rows ?? [];
  } else {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "No file or rows provided" }, { status: 400 });
    rows = parsePollingUnitsCsv(await file.text());
  }

  if (rows.length === 0) {
    return NextResponse.json({ error: "No valid rows to import" }, { status: 400 });
  }
  if (rows.length > BATCH_LIMIT) {
    return NextResponse.json(
      { error: `Batch too large (max ${BATCH_LIMIT} rows per request). Use the dashboard Import CSV button for large files.` },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  const { imported, failed } = await upsertPollingUnitRows(
    supabase,
    user.profile.tenant_id,
    rows
  );

  revalidatePath("/polling-units");
  revalidatePath("/maps");

  return NextResponse.json({ success: true, imported, failed });
}
