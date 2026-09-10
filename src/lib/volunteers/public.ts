"use server";

import { headers } from "next/headers";
import { createServiceClient } from "@/lib/supabase/admin";
import { CAMPAIGN_TENANT_ID } from "@/lib/campaign";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";
import { parseSupportRoles } from "@/lib/lms/roles";
import { enrollVolunteer, ensureTrainingCode } from "@/lib/lms/enroll";
import { generateTrainingCode } from "@/lib/lms/codes";
import { resolveAppHost, sendVolunteerTrainingCodeWhatsApp, volunteerLearnLoginUrl } from "@/lib/lms/send-training-code";

export type PublicCampaign = {
  id: string;
  name: string;
  slug: string;
};

export async function getPublicCampaignBySlug(slug: string): Promise<PublicCampaign | null> {
  const admin = createServiceClient();
  const { data } = await admin
    .from("tenants")
    .select("id, name, slug")
    .eq("slug", slug.trim().toLowerCase())
    .maybeSingle();
  if (!data?.id || !data.slug) return null;
  return { id: data.id, name: data.name?.trim() || "the campaign", slug: data.slug };
}

export async function getDefaultPublicCampaignSlug(): Promise<string> {
  try {
    const admin = createServiceClient();
    const { data } = await admin
      .from("tenants")
      .select("slug")
      .eq("id", CAMPAIGN_TENANT_ID)
      .maybeSingle();
    if (data?.slug) return data.slug;
  } catch {
    // fall through
  }
  return "campaign";
}

function cleanPhone(raw: string) {
  return raw.replace(/[^\d+]/g, "").trim();
}

export async function registerVolunteerPublic(
  slug: string,
  input: {
    fullName: string;
    phone: string;
    email?: string;
    ward?: string;
    lga?: string;
    pollingUnit?: string;
    skills?: string;
    roles?: string[];
  }
): Promise<{
  error?: string;
  success?: true;
  alreadyRegistered?: boolean;
  campaignName?: string;
  trainingCode?: string;
  slug?: string;
  whatsappSent?: boolean;
}> {
  const campaign = await getPublicCampaignBySlug(slug);
  if (!campaign) return { error: "This volunteer signup link is invalid." };
  const tenantId = campaign.id;
  const campaignSlug = campaign.slug;
  const campaignName = campaign.name;

  // Unauthenticated service-role write: throttle by source so the volunteer
  // table cannot be filled with junk PII.
  const ip = clientIp(await headers());
  const verdict = await checkRateLimit("volunteerSignup", `${campaign.slug}:${ip}`);
  if (!verdict.allowed) {
    return { error: "Too many signups from this connection. Try again later." };
  }

  const fullName = input.fullName.trim();
  const phone = cleanPhone(input.phone);
  const email = (input.email ?? "").trim().toLowerCase();
  const ward = (input.ward ?? "").trim();
  const lga = (input.lga ?? "").trim();
  const pollingUnit = (input.pollingUnit ?? "").trim();
  const skills = (input.skills ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const roles = parseSupportRoles(input.roles);

  if (fullName.length < 2) return { error: "Enter your full name." };
  if (phone.replace(/\D/g, "").length < 10) {
    return { error: "Enter a valid Nigerian phone number." };
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "Enter a valid email address." };
  }

  const admin = createServiceClient();

  const { data: existing } = await admin
    .from("volunteers")
    .select("id, training_code")
    .eq("tenant_id", tenantId)
    .eq("phone", phone)
    .maybeSingle();

  async function attachTraining(volunteerId: string, existingCode?: string | null) {
    let code = existingCode ?? "";
    try {
      code = await ensureTrainingCode(admin, tenantId, volunteerId, existingCode);
      if (roles.length) {
        await enrollVolunteer(admin, {
          tenantId,
          volunteerId,
          roles,
        });
      }
    } catch {
      if (!code) {
        code = generateTrainingCode();
        await admin.from("volunteers").update({ training_code: code, support_roles: roles }).eq("id", volunteerId);
      }
    }
    return code;
  }

  async function sendCode(volunteerId: string, trainingCode: string) {
    if (!trainingCode) return false;
    try {
      const result = await sendVolunteerTrainingCodeWhatsApp({
        supabase: admin,
        tenantId,
        volunteerId,
        phone,
        name: fullName,
        trainingCode,
        learnUrl: volunteerLearnLoginUrl(campaignSlug, resolveAppHost()),
      });
      return Boolean(result.sent);
    } catch {
      return false;
    }
  }

  if (existing?.id) {
    const patch: Record<string, unknown> = {
      full_name: fullName,
      email: email || null,
      ward: ward || null,
      lga: lga || null,
      polling_unit: pollingUnit || null,
    };
    if (skills.length) patch.skills = skills;
    if (roles.length) patch.support_roles = roles;

    await admin.from("volunteers").update(patch).eq("id", existing.id).eq("tenant_id", tenantId);
    const trainingCode = await attachTraining(existing.id, existing.training_code);
    const whatsappSent = await sendCode(existing.id, trainingCode);

    return {
      success: true,
      alreadyRegistered: true,
      campaignName,
      trainingCode,
      slug: campaignSlug,
      whatsappSent,
    };
  }

  const { data: created, error } = await admin.from("volunteers").insert({
    tenant_id: tenantId,
    full_name: fullName,
    phone,
    email: email || null,
    ward: ward || null,
    lga: lga || null,
    polling_unit: pollingUnit || null,
    skills,
    support_roles: roles,
    training_status: "pending",
    training_code: generateTrainingCode(),
  }).select("id, training_code").single();

  if (error) return { error: error.message };
  const trainingCode = created?.id
    ? await attachTraining(created.id, created.training_code)
    : undefined;

  try {
    await admin.from("activities").insert({
      tenant_id: tenantId,
      action: "volunteer.public_signup",
      description: `${fullName} registered as a volunteer`,
      metadata: { phone, lga: lga || null, ward: ward || null, source: "public_form" },
    });
  } catch {
    // non-fatal
  }

  const whatsappSent = created?.id && trainingCode ? await sendCode(created.id, trainingCode) : false;

  return { success: true, campaignName, trainingCode, slug: campaignSlug, whatsappSent };
}
