import type { SupabaseClient } from "@supabase/supabase-js";
import { phoneLookupValues } from "@/lib/lms/phone";
import {
  isInvalidContactTypeError,
  mergeInterests,
  resolvedContactType,
  type CrmPublicKind,
} from "./labels";

export type { CrmPublicKind };
export {
  SUPPORT_INTEREST,
  contactTypeLabel,
  isInvalidContactTypeError,
  mergeInterests,
  resolvedContactType,
} from "./labels";

type ContactMatch = {
  id: string;
  contact_type: string | null;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  ward: string | null;
  lga: string | null;
  support_level: string | null;
  interests: string[] | null;
  total_donations: number | null;
};

export async function findCrmContact(
  supabase: SupabaseClient,
  tenantId: string,
  input: { phone?: string | null; email?: string | null }
): Promise<ContactMatch | null> {
  const email = (input.email ?? "").trim().toLowerCase();
  if (email && email.includes("@")) {
    const { data } = await supabase
      .from("contacts")
      .select("id, contact_type, full_name, phone, email, ward, lga, support_level, interests, total_donations")
      .eq("tenant_id", tenantId)
      .ilike("email", email.replace(/[%_]/g, ""))
      .maybeSingle();
    if (data?.id) return data as ContactMatch;
  }

  const phones = phoneLookupValues(input.phone ?? "");
  if (!phones.length) return null;
  const { data } = await supabase
    .from("contacts")
    .select("id, contact_type, full_name, phone, email, ward, lga, support_level, interests, total_donations")
    .eq("tenant_id", tenantId)
    .in("phone", phones)
    .limit(1);
  const row = Array.isArray(data) ? data[0] : data;
  return row?.id ? (row as ContactMatch) : null;
}

export async function upsertPublicCrmContact(
  supabase: SupabaseClient,
  input: {
    tenantId: string;
    fullName: string;
    phone?: string | null;
    email?: string | null;
    ward?: string | null;
    lga?: string | null;
    kind: CrmPublicKind;
  }
): Promise<{ id: string; created: boolean } | { error: string }> {
  const fullName = input.fullName.trim();
  if (fullName.length < 2) return { error: "Name is required" };
  const phone = (input.phone ?? "").replace(/[^\d+]/g, "").trim() || null;
  const email = (input.email ?? "").trim().toLowerCase() || null;
  if (!phone && !(email && email.includes("@"))) {
    return { error: "A phone number or email is required" };
  }

  const existing = await findCrmContact(supabase, input.tenantId, { phone, email });
  const nextType = resolvedContactType(existing?.contact_type, input.kind);
  const interests = mergeInterests(existing?.interests, input.kind);
  const patch: Record<string, unknown> = {
    full_name: fullName,
    contact_type: nextType,
    support_level: "strong",
    interests,
  };
  if (phone) patch.phone = existing?.phone || phone;
  if (email) patch.email = existing?.email || email;
  if (input.ward?.trim()) patch.ward = input.ward.trim();
  if (input.lga?.trim()) patch.lga = input.lga.trim();

  async function insertWithFallback(
    payload: Record<string, unknown>
  ): Promise<{ id: string } | { error: string }> {
    const first = await supabase.from("contacts").insert(payload).select("id").single();
    if (!first.error && first.data?.id) return { id: first.data.id as string };
    if (payload.contact_type === "supporter" && isInvalidContactTypeError(first.error?.message)) {
      const fallback = await supabase
        .from("contacts")
        .insert({ ...payload, contact_type: "individual" })
        .select("id")
        .single();
      if (!fallback.error && fallback.data?.id) return { id: fallback.data.id as string };
      return { error: fallback.error?.message ?? first.error?.message ?? "Could not save contact" };
    }
    return { error: first.error?.message ?? "Could not save contact" };
  }

  async function updateWithFallback(id: string, payload: Record<string, unknown>) {
    const first = await supabase.from("contacts").update(payload).eq("id", id).eq("tenant_id", input.tenantId);
    if (!first.error) return { id };
    if (payload.contact_type === "supporter" && isInvalidContactTypeError(first.error.message)) {
      const fallback = await supabase
        .from("contacts")
        .update({ ...payload, contact_type: existing?.contact_type === "donor" ? "donor" : "individual" })
        .eq("id", id)
        .eq("tenant_id", input.tenantId);
      if (!fallback.error) return { id };
      return { error: fallback.error.message };
    }
    return { error: first.error.message };
  }

  if (existing?.id) {
    const updated = await updateWithFallback(existing.id, patch);
    if ("error" in updated && updated.error) return { error: updated.error };
    return { id: existing.id, created: false };
  }

  const created = await insertWithFallback({
    tenant_id: input.tenantId,
    total_donations: 0,
    ...patch,
  });
  if ("error" in created) return { error: created.error };
  return { id: created.id, created: true };
}
