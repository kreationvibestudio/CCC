"use server";

import { createServiceClient } from "@/lib/supabase/admin";
import { CAMPAIGN_TENANT_ID } from "@/lib/campaign";

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
  }
): Promise<{ error?: string; success?: true; alreadyRegistered?: boolean; campaignName?: string }> {
  const campaign = await getPublicCampaignBySlug(slug);
  if (!campaign) return { error: "This volunteer signup link is invalid." };

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
    .select("id")
    .eq("tenant_id", campaign.id)
    .eq("phone", phone)
    .maybeSingle();

  if (existing?.id) {
    const patch: Record<string, unknown> = {
      full_name: fullName,
      email: email || null,
      ward: ward || null,
      lga: lga || null,
      polling_unit: pollingUnit || null,
    };
    if (skills.length) patch.skills = skills;

    await admin.from("volunteers").update(patch).eq("id", existing.id).eq("tenant_id", campaign.id);

    return {
      success: true,
      alreadyRegistered: true,
      campaignName: campaign.name,
    };
  }

  const { error } = await admin.from("volunteers").insert({
    tenant_id: campaign.id,
    full_name: fullName,
    phone,
    email: email || null,
    ward: ward || null,
    lga: lga || null,
    polling_unit: pollingUnit || null,
    skills,
    training_status: "pending",
  });

  if (error) return { error: error.message };

  try {
    await admin.from("activities").insert({
      tenant_id: campaign.id,
      action: "volunteer.public_signup",
      description: `${fullName} registered as a volunteer`,
      metadata: { phone, lga: lga || null, ward: ward || null, source: "public_form" },
    });
  } catch {
    // non-fatal
  }

  return { success: true, campaignName: campaign.name };
}
