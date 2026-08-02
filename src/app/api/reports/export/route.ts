import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission } from "@/types/auth";
import { getAnalyticsSummary } from "@/lib/analytics/data";
import { buildSummaryPdf } from "@/lib/reports/pdf-summary";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(user.role, "reports.generate") && !hasPermission(user.role, "reports.view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const type = req.nextUrl.searchParams.get("type") ?? "volunteers";
  const format = req.nextUrl.searchParams.get("format") ?? "xlsx";
  const ward = req.nextUrl.searchParams.get("ward");
  const lga = req.nextUrl.searchParams.get("lga");
  const tenantId = user.profile.tenant_id;
  const supabase = await createClient();

  if (format === "pdf" && (type === "summary" || type === "ward-report")) {
    const summary = await getAnalyticsSummary(tenantId);
    const buffer = await buildSummaryPdf(summary);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="campaign-${type}.pdf"`,
      },
    });
  }

  const tableMap: Record<string, string> = {
    volunteers: "volunteers",
    contacts: "contacts",
    comments: "comments",
    sentiment: "comments",
    "polling-units": "polling_units",
    events: "campaign_events",
  };
  const table = tableMap[type];
  if (!table) return NextResponse.json({ error: "Unknown type" }, { status: 400 });

  let q = supabase.from(table).select("*").eq("tenant_id", tenantId).limit(5000);
  if (ward) q = q.eq("ward", ward);
  if (lga) q = q.eq("lga", lga);
  const { data } = await q;
  const rows = data ?? [];
  if (rows.length === 0) {
    return NextResponse.json({ error: "No data to export" }, { status: 404 });
  }

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(type);
  const columns = Object.keys(rows[0]).filter((k) => k !== "tenant_id");
  sheet.columns = columns.map((k) => ({ header: k, key: k, width: 18 }));
  for (const row of rows) {
    const r: Record<string, unknown> = {};
    for (const k of columns) r[k] = (row as Record<string, unknown>)[k];
    sheet.addRow(r);
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${type}${ward ? `-${ward}` : ""}.xlsx"`,
    },
  });
}
