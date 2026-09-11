"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { authorize } from "@/lib/auth/session";
import { denyCreateIfRestricted, denyDeleteIfRestricted } from "@/types/auth";
import { fetchAllRows } from "@/lib/supabase/paginate";
import type { Contact, Donation } from "@/types/database";
import { assertContactInTenant } from "@/lib/tenancy";
import { createServiceClient } from "@/lib/supabase/admin";
import { isInvalidContactTypeError, upsertPublicCrmContact } from "@/lib/crm/public-upsert";

/**
 * CRM writes go through the caller's own session so tenant RLS applies on top of
 * the explicit tenant filters. These used to run as the service role, which
 * bypassed RLS entirely for contact PII.
 */
async function crmDb() {
  return createClient();
}

export async function createContact(formData: FormData) {
  const gate = await authorize("crm.manage");
  if (!gate.ok) return { error: gate.error };
  const user = gate.user;
  const blocked = denyCreateIfRestricted(user.role);
  if (blocked) return { error: blocked };
  const fullName = String(formData.get("full_name") ?? "").trim();
  if (!fullName) return { error: "Name is required" };
  const supabase = await crmDb();
  const contactType = String(formData.get("contact_type") ?? "individual");
  const payload: Record<string, unknown> = {
    tenant_id: user.profile.tenant_id,
    full_name: fullName,
    contact_type: contactType,
    phone: formData.get("phone") as string || null,
    email: formData.get("email") as string || null,
    ward: formData.get("ward") as string || null,
    lga: formData.get("lga") as string || null,
    support_level: formData.get("support_level") as string || "undecided",
  };
  if (contactType === "supporter") payload.interests = ["support"];
  let { error } = await supabase.from("contacts").insert(payload);
  if (error && contactType === "supporter" && isInvalidContactTypeError(error.message)) {
    const retry = await supabase.from("contacts").insert({ ...payload, contact_type: "individual" });
    error = retry.error;
  }
  if (error) return { error: error.message };
  revalidatePath("/crm");
  return { success: true };
}

/** Tenant comes from the session, never from a caller-supplied argument. */
export async function getContacts() {
  const gate = await authorize("crm.view");
  if (!gate.ok) return [];
  const supabase = await createClient();
  const tenantId = gate.user.profile.tenant_id;
  try {
    await backfillVolunteersIntoCrm(tenantId);
  } catch {
    // Listing still works if volunteer sync is unavailable.
  }
  return fetchAllRows<Contact>(
    (from, to) =>
      supabase
        .from("contacts")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("full_name")
        .range(from, to),
    { max: 5000 }
  );
}

async function backfillVolunteersIntoCrm(tenantId: string) {
  const admin = createServiceClient();
  const [{ data: volunteers }, { data: contacts }] = await Promise.all([
    admin.from("volunteers").select("full_name, phone, email, ward, lga").eq("tenant_id", tenantId).limit(200),
    admin.from("contacts").select("phone, email").eq("tenant_id", tenantId).limit(5000),
  ]);
  const phones = new Set(
    (contacts ?? []).flatMap((row) => (row.phone ? [String(row.phone).replace(/[^\d+]/g, "")] : []))
  );
  const emails = new Set(
    (contacts ?? []).flatMap((row) => (row.email ? [String(row.email).trim().toLowerCase()] : []))
  );
  for (const volunteer of volunteers ?? []) {
    const phone = (volunteer.phone ?? "").replace(/[^\d+]/g, "");
    const email = (volunteer.email ?? "").trim().toLowerCase();
    if ((phone && phones.has(phone)) || (email && emails.has(email))) continue;
    if (!phone && !email) continue;
    const result = await upsertPublicCrmContact(admin, {
      tenantId,
      fullName: volunteer.full_name,
      phone: volunteer.phone,
      email: volunteer.email,
      ward: volunteer.ward,
      lga: volunteer.lga,
      kind: "supporter",
    });
    if ("id" in result) {
      if (phone) phones.add(phone);
      if (email) emails.add(email);
    }
  }
}

export async function getContact(id: string) {
  const gate = await authorize("crm.view");
  if (!gate.ok) return null;
  const user = gate.user;
  const supabase = await createClient();
  const { data } = await supabase.from("contacts").select("*").eq("id", id).eq("tenant_id", user.profile.tenant_id).single();
  return data;
}

export async function updateContact(id: string, formData: FormData) {
  const gate = await authorize("crm.manage");
  if (!gate.ok) return { error: gate.error };
  const user = gate.user;
  const blocked = denyCreateIfRestricted(user.role);
  if (blocked) return { error: blocked };
  const supabase = await crmDb();
  const { error } = await supabase.from("contacts").update({
    full_name: formData.get("full_name"),
    contact_type: formData.get("contact_type"),
    phone: formData.get("phone") || null,
    email: formData.get("email") || null,
    ward: formData.get("ward") || null,
    lga: formData.get("lga") || null,
    support_level: formData.get("support_level") || "undecided",
    notes: formData.get("notes") || null,
  }).eq("id", id).eq("tenant_id", user.profile.tenant_id);
  if (error) return { error: error.message };
  revalidatePath("/crm");
  revalidatePath(`/crm/${id}`);
  return { success: true };
}

export async function deleteContact(id: string) {
  const gate = await authorize("crm.manage");
  if (!gate.ok) return { error: gate.error };
  const user = gate.user;
  const blocked = denyDeleteIfRestricted(user.role);
  if (blocked) return { error: blocked };
  const supabase = await crmDb();
  const { error } = await supabase.from("contacts").delete().eq("id", id).eq("tenant_id", user.profile.tenant_id);
  if (error) return { error: error.message };
  revalidatePath("/crm");
  return { success: true };
}

export async function logInteraction(contactId: string, formData: FormData) {
  const gate = await authorize("crm.manage");
  if (!gate.ok) return { error: gate.error };
  const user = gate.user;
  const blocked = denyCreateIfRestricted(user.role);
  if (blocked) return { error: blocked };
  const contactError = await assertContactInTenant(user.profile.tenant_id, contactId);
  if (contactError) return { error: contactError };
  const supabase = await crmDb();
  const { error } = await supabase.from("contact_interactions").insert({
    contact_id: contactId,
    staff_id: user.id,
    interaction_type: formData.get("interaction_type") as string,
    notes: formData.get("notes") as string,
  });
  if (error) return { error: error.message };
  revalidatePath(`/crm/${contactId}`);
  return { success: true };
}

export async function recordDonation(contactId: string, formData: FormData) {
  const gate = await authorize("donations.manage");
  if (!gate.ok) return { error: gate.error };
  const user = gate.user;
  const blocked = denyCreateIfRestricted(user.role);
  if (blocked) return { error: blocked };
  const contactError = await assertContactInTenant(user.profile.tenant_id, contactId);
  if (contactError) return { error: contactError };
  const supabase = await crmDb();
  const amount = Number(formData.get("amount"));
  if (!Number.isFinite(amount) || amount <= 0) return { error: "Enter a valid amount" };
  const { error } = await supabase.from("donations").insert({
    tenant_id: user.profile.tenant_id,
    contact_id: contactId,
    amount,
    payment_method: formData.get("payment_method") as string || "cash",
  });
  if (error) return { error: error.message };
  const { data: contact } = await supabase
    .from("contacts")
    .select("total_donations")
    .eq("id", contactId)
    .eq("tenant_id", user.profile.tenant_id)
    .single();
  await supabase
    .from("contacts")
    .update({ total_donations: (contact?.total_donations ?? 0) + amount })
    .eq("id", contactId)
    .eq("tenant_id", user.profile.tenant_id);
  revalidatePath(`/crm/${contactId}`);
  revalidatePath("/donations");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function getContactInteractions(contactId: string) {
  const gate = await authorize("crm.view");
  if (!gate.ok) return [];
  const user = gate.user;
  const contactError = await assertContactInTenant(user.profile.tenant_id, contactId);
  if (contactError) return [];
  const supabase = await createClient();
  const { data } = await supabase.from("contact_interactions").select("*, profiles(full_name)").eq("contact_id", contactId).order("created_at", { ascending: false });
  return data ?? [];
}

export async function getContactDonations(contactId: string) {
  const gate = await authorize("donations.view");
  if (!gate.ok) return [];
  const user = gate.user;
  const contactError = await assertContactInTenant(user.profile.tenant_id, contactId);
  if (contactError) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("donations")
    .select("*")
    .eq("contact_id", contactId)
    .eq("tenant_id", user.profile.tenant_id)
    .order("created_at", { ascending: false });
  return (data ?? []) as Donation[];
}
