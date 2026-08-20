import { createServiceClient } from "@/lib/supabase/admin";
import { CAMPAIGN_TENANT_ID } from "@/lib/campaign";

export type RecordedCharge = {
  alreadyRecorded: boolean;
  donationId: string;
  amount: number;
};

export async function recordSuccessfulPaystackCharge(input: {
  reference: string;
  amountKobo: number;
  email: string;
  fullName?: string | null;
  phone?: string | null;
  channel?: string | null;
  tenantId?: string | null;
}): Promise<{ data: RecordedCharge } | { error: string }> {
  const reference = input.reference.trim();
  const email = input.email.trim().toLowerCase();
  const amount = input.amountKobo / 100;
  if (!reference) return { error: "Missing payment reference" };
  if (!email || !email.includes("@")) return { error: "Missing donor email" };
  if (!Number.isFinite(amount) || amount <= 0) return { error: "Invalid amount" };

  const tenantId = input.tenantId?.trim() || CAMPAIGN_TENANT_ID;
  const admin = createServiceClient();

  const { data: existing } = await admin
    .from("donations")
    .select("id, amount")
    .eq("payment_reference", reference)
    .maybeSingle();
  if (existing) {
    return { data: { alreadyRecorded: true, donationId: existing.id, amount: Number(existing.amount) } };
  }

  const phone = input.phone?.trim() || null;
  const fullName = (input.fullName?.trim() || email.split("@")[0]).slice(0, 120);

  let contactId: string | null = null;
  let previousTotal = 0;

  const { data: byEmail } = await admin
    .from("contacts")
    .select("id, total_donations, phone")
    .eq("tenant_id", tenantId)
    .ilike("email", email.replace(/[%_]/g, ""))
    .maybeSingle();

  if (byEmail) {
    contactId = byEmail.id;
    previousTotal = Number(byEmail.total_donations ?? 0);
    if (phone && !byEmail.phone) {
      await admin.from("contacts").update({ phone }).eq("id", contactId);
    }
  } else if (phone) {
    const { data: byPhone } = await admin
      .from("contacts")
      .select("id, total_donations")
      .eq("tenant_id", tenantId)
      .eq("phone", phone)
      .maybeSingle();
    if (byPhone) {
      contactId = byPhone.id;
      previousTotal = Number(byPhone.total_donations ?? 0);
      await admin.from("contacts").update({ email, full_name: fullName }).eq("id", contactId);
    }
  }

  if (!contactId) {
    const { data: created, error: createError } = await admin
      .from("contacts")
      .insert({
        tenant_id: tenantId,
        full_name: fullName,
        contact_type: "donor",
        email,
        phone,
        support_level: "strong",
        total_donations: 0,
      })
      .select("id")
      .single();
    if (createError || !created) return { error: createError?.message ?? "Could not save donor" };
    contactId = created.id;
    previousTotal = 0;
  }

  const method = input.channel ? `paystack_${input.channel}` : "paystack";
  const { data: donation, error: donationError } = await admin
    .from("donations")
    .insert({
      tenant_id: tenantId,
      contact_id: contactId,
      amount,
      currency: "NGN",
      payment_method: method,
      payment_reference: reference,
    })
    .select("id")
    .single();

  if (donationError) {
    if (/duplicate|unique/i.test(donationError.message)) {
      const { data: again } = await admin
        .from("donations")
        .select("id, amount")
        .eq("payment_reference", reference)
        .maybeSingle();
      if (again) {
        return { data: { alreadyRecorded: true, donationId: again.id, amount: Number(again.amount) } };
      }
    }
    return { error: donationError.message };
  }

  await admin.from("contacts").update({ total_donations: previousTotal + amount }).eq("id", contactId);

  return { data: { alreadyRecorded: false, donationId: donation.id, amount } };
}
