import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { denyWriteIfRestricted, hasPermission } from "@/types/auth";
import { createClient } from "@/lib/supabase/server";
import {
  getTermiiAccount,
  renderTemplate,
  sendTermiiSms,
} from "@/lib/integrations/termii/client";
import { fetchAllRows } from "@/lib/supabase/paginate";
import { checkRateLimit, tooManyRequests } from "@/lib/rate-limit";

/**
 * Ceiling on one broadcast. The old code silently took the first 100 matching
 * contacts, so a campaign looked "sent" while most of the audience never got a
 * message. Raise with COMMUNICATIONS_MAX_RECIPIENTS.
 */
function maxRecipients() {
  const configured = Number(process.env.COMMUNICATIONS_MAX_RECIPIENTS);
  return Number.isFinite(configured) && configured > 0 ? Math.floor(configured) : 1000;
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(user.role, "communications.send")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const blocked = denyWriteIfRestricted(user.role);
  if (blocked) return NextResponse.json({ error: blocked }, { status: 403 });

  // Bulk SMS spends real money, so throttle by workspace rather than by user.
  const burst = await checkRateLimit("smsBurst", user.profile.tenant_id);
  if (!burst.allowed) {
    return tooManyRequests(burst, "Too many send requests. Wait a moment and try again.");
  }

  const account = await getTermiiAccount();
  if (!account.ok) {
    return NextResponse.json({ error: account.error }, { status: 503 });
  }
  if (account.balance != null && account.balance <= 0) {
    return NextResponse.json(
      { error: "Termii wallet has no credit. Top up the Termii balance, then retry." },
      { status: 402 }
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

    const cap = maxRecipients();
    const contacts = await fetchAllRows<{ phone: string | null; full_name: string | null }>(
      (rangeFrom, rangeTo) => {
        let q = supabase
          .from("contacts")
          .select("phone, full_name")
          .eq("tenant_id", tenantId)
          .not("phone", "is", null)
          .order("created_at");
        if (ward) q = q.eq("ward", ward);
        if (supportLevel) q = q.eq("support_level", supportLevel);
        return q.range(rangeFrom, rangeTo);
      },
      { max: cap + 1 }
    );

    if (!contacts.length) {
      return NextResponse.json(
        { error: "No contacts with phone numbers match these audience filters" },
        { status: 400 }
      );
    }

    // One extra row was fetched purely to detect that more exist.
    const capped = contacts.length > cap;
    const audience = capped ? contacts.slice(0, cap) : contacts;

    const daily = await checkRateLimit("smsDaily", tenantId, { increment: audience.length });
    if (!daily.allowed) {
      return tooManyRequests(
        daily,
        "This workspace has reached its daily SMS allowance. Try again tomorrow or raise the limit."
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
    const reasons: string[] = [];
    for (const c of audience) {
      if (!c.phone) continue;
      const text = renderTemplate(templateBody, {
        name: (c.full_name ?? "Friend").split(" ")[0],
      });
      const result = await sendTermiiSms(c.phone, text);
      await supabase.from("messages").insert({
        tenant_id: tenantId,
        campaign_id: campaignId,
        recipient_phone: c.phone,
        channel: "sms",
        body: text,
        status: result.ok ? "sent" : "failed",
        sent_at: result.ok ? new Date().toISOString() : null,
      });
      if (result.ok) sent++;
      else {
        failed++;
        if (result.error && reasons.length < 3 && !reasons.includes(result.error)) {
          reasons.push(result.error);
        }
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
              ? `All ${failed} SMS send${failed === 1 ? "" : "s"} failed. ${reasons.join(" ")}`
              : "No messages were sent",
          sent: 0,
          failed,
          reasons,
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      sent,
      failed,
      recipients: audience.length,
      capped,
      cap,
    });
  }

  if (!phone || !message) {
    return NextResponse.json({ error: "phone and message required" }, { status: 400 });
  }

  const result = await sendTermiiSms(phone, message);
  await supabase.from("messages").insert({
    tenant_id: tenantId,
    recipient_phone: phone,
    channel: "sms",
    body: message,
    status: result.ok ? "sent" : "failed",
    sent_at: result.ok ? new Date().toISOString() : null,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error ?? "Send failed", result }, { status: 502 });
  }
  return NextResponse.json({ success: true, result });
}
