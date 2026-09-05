"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { authorize } from "@/lib/auth/session";
import { fetchAllRows } from "@/lib/supabase/paginate";
import type { Contact, Donation } from "@/types/database";
import { assertContactInTenant } from "@/lib/tenancy";

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
  const fullName = String(formData.get("full_name") ?? "").trim();
  if (!fullName) return { error: "Name is required" };
  const supabase = await crmDb();
  const { error } = await supabase.from("contacts").insert({
    tenant_id: user.profile.tenant_id,
    full_name: fullName,
    contact_type: formData.get("contact_type") as string,
    phone: formData.get("phone") as string || null,
    email: formData.get("email") as string || null,
    ward: formData.get("ward") as string || null,
    lga: formData.get("lga") as string || null,
    support_level: formData.get("support_level") as string || "undecided",
  });
  if (error) return { error: error.message };
  revalidatePath("/crm");
  return { success: true };
}

/** Tenant comes from the session, never from a caller-supplied argument. */
export async function getContacts() {
  const gate = await authorize("crm.view");
  if (!gate.ok) return [];
  const supabase = await createClient();
  return fetchAllRows<Contact>(
    (from, to) =>
      supabase
        .from("contacts")
        .select("*")
        .eq("tenant_id", gate.user.profile.tenant_id)
        .order("full_name")
        .range(from, to),
    { max: 5000 }
  );
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
  const gate = await authorize("crm.manage");
  if (!gate.ok) return { error: gate.error };
  const user = gate.user;
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
  const gate = await authorize("crm.view");
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
