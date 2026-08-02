import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission } from "@/types/auth";
import { createClient } from "@/lib/supabase/server";
import { sendTermiiSms, renderTemplate } from "@/lib/integrations/termii/client";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(user.role, "communications.send")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { templateId, phone, message, campaignId, ward, supportLevel } = body as {
    templateId?: string;
    phone?: string;
    message?: string;
    campaignId?: string;
    ward?: string;
    supportLevel?: string;
  };

  const supabase = await createClient();
  const tenantId = user.profile.tenant_id;

  if (campaignId && !phone) {
    let q = supabase.from("contacts").select("phone, full_name").eq("tenant_id", tenantId).not("phone", "is", null);
    if (ward) q = q.eq("ward", ward);
    if (supportLevel) q = q.eq("support_level", supportLevel);
    const { data: contacts } = await q.limit(100);

    let templateBody = message ?? "";
    if (templateId) {
      const { data: tpl } = await supabase.from("message_templates").select("body").eq("id", templateId).single();
      templateBody = tpl?.body ?? templateBody;
    }

    let sent = 0;
    for (const c of contacts ?? []) {
      if (!c.phone) continue;
      const text = renderTemplate(templateBody, { name: c.full_name.split(" ")[0] });
      try {
        const result = await sendTermiiSms(c.phone, text);
        await supabase.from("messages").insert({
          tenant_id: tenantId,
          campaign_id: campaignId,
          recipient_phone: c.phone,
          channel: "sms",
          body: text,
          status: result.message_id ? "sent" : "failed",
          sent_at: result.message_id ? new Date().toISOString() : null,
        });
        if (result.message_id) sent++;
      } catch {
        /* continue batch */
      }
    }
    await supabase.from("message_campaigns").update({ sent_count: sent, status: "sent" }).eq("id", campaignId);
    return NextResponse.json({ success: true, sent });
  }

  if (!phone || !message) return NextResponse.json({ error: "phone and message required" }, { status: 400 });

  try {
    const result = await sendTermiiSms(phone, message);
    await supabase.from("messages").insert({
      tenant_id: tenantId,
      recipient_phone: phone,
      channel: "sms",
      body: message,
      status: result.message_id ? "sent" : "failed",
      sent_at: result.message_id ? new Date().toISOString() : null,
    });
    return NextResponse.json({ success: true, result });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Send failed" }, { status: 500 });
  }
}
