"use server";

import { headers } from "next/headers";
import { createServiceClient } from "@/lib/supabase/admin";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";
import { isMissingRelationError } from "@/lib/public-error";
import { ensureTenantPollingUnitFromNational } from "@/lib/polling-units/national";
import { formatPollingUnitCode } from "@/lib/polling-units/code";
import { getPublicCampaignBySlug } from "@/lib/volunteers/public";
import {
  memberDisplayName,
  validateMemberRegistration,
  type MemberRegistrationInput,
} from "@/lib/members/validate";

export async function registerUnitMemberPublic(
  slug: string,
  input: MemberRegistrationInput
): Promise<{
  error?: string;
  success?: true;
  alreadyRegistered?: boolean;
  campaignName?: string;
  needsMigration?: boolean;
}> {
  const campaign = await getPublicCampaignBySlug(slug);
  if (!campaign) return { error: "This member registration link is invalid." };

  const requestHeaders = await headers();
  const ip = clientIp(requestHeaders);
  const verdict = await checkRateLimit("volunteerSignup", `${campaign.slug}:member:${ip}`);
  if (!verdict.allowed) {
    return { error: "Too many registrations from this connection. Try again later." };
  }

  const validated = validateMemberRegistration(input);
  if ("error" in validated) return { error: validated.error };
  const value = validated.value;

  const admin = createServiceClient();
  const tenantId = campaign.id;

  let pollingUnitId = value.pollingUnitId;
  let unitCode = value.unitCode;
  let unitName = value.unitName;

  if (pollingUnitId) {
    const ensured = await ensureTenantPollingUnitFromNational({
      tenantId,
      nationalId: pollingUnitId,
    });
    if ("error" in ensured) return { error: ensured.error };
    pollingUnitId = ensured.id;
    const { data: pu } = await admin
      .from("polling_units")
      .select("id, code, pu_code, name")
      .eq("tenant_id", tenantId)
      .eq("id", pollingUnitId)
      .maybeSingle();
    if (pu) {
      unitCode = formatPollingUnitCode(pu) || unitCode;
      unitName = (pu.name ?? "").trim() || unitName;
    }
  }

  const { data: existing } = await admin
    .from("unit_members")
    .select("id")
    .eq("tenant_id", tenantId)
    .or(
      `phone.eq.${value.phone},voters_card_number.eq.${value.votersCardNumber},membership_card_number.eq.${value.membershipCardNumber}`
    )
    .maybeSingle();

  if (existing?.id) {
    await admin
      .from("unit_members")
      .update({
        first_name: value.firstName,
        last_name: value.lastName,
        phone: value.phone,
        voters_card_number: value.votersCardNumber,
        membership_card_number: value.membershipCardNumber,
        state: value.state,
        lga: value.lga,
        ward: value.ward,
        unit_code: unitCode,
        unit_name: unitName,
        polling_unit_id: pollingUnitId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id)
      .eq("tenant_id", tenantId);
    return { success: true, alreadyRegistered: true, campaignName: campaign.name };
  }

  const { error } = await admin.from("unit_members").insert({
    tenant_id: tenantId,
    polling_unit_id: pollingUnitId,
    first_name: value.firstName,
    last_name: value.lastName,
    phone: value.phone,
    voters_card_number: value.votersCardNumber,
    membership_card_number: value.membershipCardNumber,
    state: value.state,
    lga: value.lga,
    ward: value.ward,
    unit_code: unitCode,
    unit_name: unitName,
  });

  if (error) {
    if (isMissingRelationError(error.message, "unit_members")) {
      return { error: "Member registration is not available yet.", needsMigration: true };
    }
    return { error: error.message };
  }

  try {
    await admin.from("activities").insert({
      tenant_id: tenantId,
      action: "member.public_signup",
      description: `${memberDisplayName(value.firstName, value.lastName)} registered as an NDC unit member`,
      metadata: {
        phone: value.phone,
        lga: value.lga,
        ward: value.ward,
        unit_code: unitCode,
        source: "public_form",
      },
    });
  } catch {
    // non-fatal
  }

  return { success: true, campaignName: campaign.name };
}
