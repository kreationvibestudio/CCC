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

  if (!process.env.TERMII_API_KEY) {
    return NextResponse.json(
      { error: "TERMII_API_KEY is not configured. Add it in Vercel env or .env.local." },
      { status: 503 }
    );
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
    const { data: campaign, error: campaignError } = await supabase
      .from("message_campaigns")
      .select("id, status, channel, template_id, tenant_id")
      .eq("id", campaignId)
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (campaignError || !campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }
    if (campaign.channel !== "sms") {
      return NextResponse.json({ error: "Only SMS campaigns can be sent" }, { status: 400 });
    }
    if (campaign.status !== "draft") {
      return NextResponse.json(
        { error: `Campaign is already ${campaign.status}` },
        { status: 400 }
      );
    }

    let q = supabase
      .from("contacts")
      .select("phone, full_name")
      .eq("tenant_id", tenantId)
      .not("phone", "is", null);
    if (ward) q = q.eq("ward", ward);
    if (supportLevel) q = q.eq("support_level", supportLevel);
    const { data: contacts } = await q.limit(100);

    if (!contacts?.length) {
      return NextResponse.json(
        { error: "No contacts with phone numbers match these audience filters" },
        { status: 400 }
      );
    }

    const resolvedTemplateId = templateId || campaign.template_id || undefined;
    let templateBody = message ?? "";
    if (resolvedTemplateId) {
      const { data: tpl } = await supabase
        .from("message_templates")
        .select("body, channel")
        .eq("id", resolvedTemplateId)
        .eq("tenant_id", tenantId)
        .maybeSingle();
      if (!tpl) {
        return NextResponse.json({ error: "Template not found" }, { status: 404 });
      }
      templateBody = tpl.body;
    }

    if (!templateBody.trim()) {
      return NextResponse.json(
        { error: "Select an SMS template (or provide a message) before sending" },
        { status: 400 }
      );
    }

    let sent = 0;
    let failed = 0;
    for (const c of contacts) {
      if (!c.phone) continue;
      const text = renderTemplate(templateBody, {
        name: (c.full_name ?? "Friend").split(" ")[0],
      });
      try {
        const result = await sendTermiiSms(c.phone, text);
        const ok = Boolean(result.message_id);
        await supabase.from("messages").insert({
          tenant_id: tenantId,
          campaign_id: campaignId,
          recipient_phone: c.phone,
          channel: "sms",
          body: text,
          status: ok ? "sent" : "failed",
          sent_at: ok ? new Date().toISOString() : null,
        });
        if (ok) sent++;
        else failed++;
      } catch {
        failed++;
        await supabase.from("messages").insert({
          tenant_id: tenantId,
          campaign_id: campaignId,
          recipient_phone: c.phone,
          channel: "sms",
          body: text,
          status: "failed",
        });
      }
    }

    await supabase
      .from("message_campaigns")
      .update({
        sent_count: sent,
        status: sent > 0 ? "sent" : "draft",
        ...(resolvedTemplateId ? { template_id: resolvedTemplateId } : {}),
      })
      .eq("id", campaignId)
      .eq("tenant_id", tenantId);

    if (sent === 0) {
      return NextResponse.json(
        {
          error:
            failed > 0
              ? `All ${failed} SMS sends failed. Check TERMII_API_KEY / sender ID.`
              : "No messages were sent",
          sent: 0,
          failed,
        },
        { status: 502 }
      );
    }

    return NextResponse.json({ success: true, sent, failed, recipients: contacts.length });
  }

  if (!phone || !message) {
    return NextResponse.json({ error: "phone and message required" }, { status: 400 });
  }

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
