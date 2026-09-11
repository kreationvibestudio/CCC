"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { authorize, logAudit } from "@/lib/auth/session";
import { denyCreateIfRestricted } from "@/types/auth";
import { upsertPublicCrmContact } from "@/lib/crm/public-upsert";

function revalidateDonationSurfaces(contactId?: string) {
  revalidatePath("/donations");
  revalidatePath("/dashboard");
  revalidatePath("/crm");
  revalidatePath("/analytics");
  if (contactId) revalidatePath(`/crm/${contactId}`);
}

export async function updateFundraisingGoal(formData: FormData) {
  const gate = await authorize("donations.manage");
  if (!gate.ok) return { error: gate.error };
  const blocked = denyCreateIfRestricted(gate.user.role);
  if (blocked) return { error: blocked };

  const raw = String(formData.get("fundraising_goal") ?? "").replace(/,/g, "").trim();
  const goal = Number(raw);
  if (!Number.isFinite(goal) || goal < 0) return { error: "Enter a valid fundraising goal" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("tenants")
    .update({ fundraising_goal: Math.round(goal) })
    .eq("id", gate.user.profile.tenant_id);
  if (error) return { error: error.message };

  await logAudit("donations.goal_update", "tenant", gate.user.profile.tenant_id, { fundraising_goal: Math.round(goal) });
  revalidateDonationSurfaces();
  return { success: true as const };
}

export async function recordHqDonation(formData: FormData) {
  const gate = await authorize("donations.manage");
  if (!gate.ok) return { error: gate.error };
  const blocked = denyCreateIfRestricted(gate.user.role);
  if (blocked) return { error: blocked };

  const fullName = String(formData.get("full_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const phone = String(formData.get("phone") ?? "").replace(/[^\d+]/g, "").trim();
  const amount = Number(String(formData.get("amount") ?? "").replace(/,/g, ""));
  const paymentMethod = String(formData.get("payment_method") ?? "bank_transfer").trim() || "bank_transfer";

  if (fullName.length < 2) return { error: "Enter the donor’s name" };
  if (!email.includes("@") && phone.replace(/\D/g, "").length < 10) {
    return { error: "Enter an email or a valid Nigerian phone number" };
  }
  if (!Number.isFinite(amount) || amount <= 0) return { error: "Enter a valid amount" };

  const supabase = await createClient();
  const upserted = await upsertPublicCrmContact(supabase, {
    tenantId: gate.user.profile.tenant_id,
    fullName,
    email: email.includes("@") ? email : null,
    phone: phone || null,
    kind: "donor",
  });
  if ("error" in upserted) return { error: upserted.error };
  const contactId = upserted.id;

  const { error } = await supabase.from("donations").insert({
    tenant_id: gate.user.profile.tenant_id,
    contact_id: contactId,
    amount,
    currency: "NGN",
    payment_method: paymentMethod,
  });
  if (error) return { error: error.message };

  const { data: contact } = await supabase
    .from("contacts")
    .select("total_donations")
    .eq("id", contactId)
    .eq("tenant_id", gate.user.profile.tenant_id)
    .single();
  await supabase
    .from("contacts")
    .update({ total_donations: Number(contact?.total_donations ?? 0) + amount })
    .eq("id", contactId)
    .eq("tenant_id", gate.user.profile.tenant_id);

  await logAudit("donations.record", "contact", contactId, { amount, payment_method: paymentMethod });
  revalidateDonationSurfaces(contactId);
  return { success: true as const };
}
