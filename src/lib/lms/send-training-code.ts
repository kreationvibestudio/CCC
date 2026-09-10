import type { SupabaseClient } from "@supabase/supabase-js";
import {
  sendTermiiEmailTemplate,
  sendTermiiWhatsAppTemplate,
  termiiEmailConfigured,
  termiiWhatsAppConfigured,
} from "@/lib/integrations/termii/client";
import { logLmsActivity } from "./enroll";
import { resolveAppHost, volunteerLearnLoginUrl } from "./learn-url";

export { resolveAppHost, volunteerLearnLoginUrl };

export type TrainingCodeSendResult = {
  whatsappSent: boolean;
  emailSent: boolean;
  skipped?: boolean;
  error?: string;
};

async function sendVolunteerTrainingCodeEmail(input: {
  supabase: SupabaseClient;
  tenantId: string;
  volunteerId?: string | null;
  actorId?: string | null;
  email: string;
  name: string;
  trainingCode: string;
  learnUrl: string;
  requireConfigured?: boolean;
}): Promise<{ sent: boolean; skipped?: boolean; error?: string }> {
  if (!input.trainingCode.trim()) {
    return { sent: false, error: "This volunteer does not have a training code yet." };
  }
  const learnUrl = input.learnUrl.trim();
  if (!learnUrl) {
    return { sent: false, error: "Training login URL is missing. Set NEXT_PUBLIC_APP_URL." };
  }
  if (!termiiEmailConfigured()) {
    if (input.requireConfigured) {
      return {
        sent: false,
        error:
          "Email is not configured. Add TERMII_EMAIL_CONFIGURATION_ID and TERMII_EMAIL_TEMPLATE_ID in Vercel.",
      };
    }
    return { sent: false, skipped: true };
  }

  const result = await sendTermiiEmailTemplate({
    to: input.email,
    name: input.name,
    code: input.trainingCode,
    url: learnUrl,
  });
  if (!result.ok) {
    return { sent: false, error: result.error ?? "Could not send the training code email." };
  }

  await logLmsActivity(input.supabase, {
    tenantId: input.tenantId,
    volunteerId: input.volunteerId ?? null,
    actorId: input.actorId ?? null,
    action: "training.code_email",
    detail: "Training code sent by email",
    metadata: { message_id: result.messageId ?? null, channel: "email" },
  });
  return { sent: true };
}

export async function sendVolunteerTrainingCodeWhatsApp(input: {
  supabase: SupabaseClient;
  tenantId: string;
  volunteerId?: string | null;
  actorId?: string | null;
  phone: string;
  name: string;
  trainingCode: string;
  learnUrl: string;
  requireConfigured?: boolean;
}): Promise<{ sent: boolean; skipped?: boolean; error?: string }> {
  if (!input.trainingCode.trim()) {
    return { sent: false, error: "This volunteer does not have a training code yet." };
  }
  const learnUrl = input.learnUrl.trim();
  if (!learnUrl) {
    return { sent: false, error: "Training login URL is missing. Set NEXT_PUBLIC_APP_URL." };
  }
  if (!termiiWhatsAppConfigured()) {
    if (input.requireConfigured) {
      return {
        sent: false,
        error:
          "WhatsApp is not configured. Add TERMII_WHATSAPP_DEVICE_ID and TERMII_WHATSAPP_TEMPLATE_ID in Vercel.",
      };
    }
    return { sent: false, skipped: true };
  }

  const result = await sendTermiiWhatsAppTemplate({
    to: input.phone,
    name: input.name,
    code: input.trainingCode,
    url: learnUrl,
  });
  if (!result.ok) {
    return { sent: false, error: result.error ?? "Could not send the WhatsApp training code." };
  }

  await logLmsActivity(input.supabase, {
    tenantId: input.tenantId,
    volunteerId: input.volunteerId ?? null,
    actorId: input.actorId ?? null,
    action: "training.code_whatsapp",
    detail: "Training code sent on WhatsApp",
    metadata: { message_id: result.messageId ?? null, channel: "whatsapp" },
  });
  return { sent: true };
}

export async function sendVolunteerTrainingCodes(input: {
  supabase: SupabaseClient;
  tenantId: string;
  volunteerId?: string | null;
  actorId?: string | null;
  phone?: string | null;
  email?: string | null;
  name: string;
  trainingCode: string;
  learnUrl: string;
  requireConfigured?: boolean;
}): Promise<TrainingCodeSendResult> {
  const requireConfigured = Boolean(input.requireConfigured);
  const whatsappOn = termiiWhatsAppConfigured();
  const emailOn = termiiEmailConfigured();
  if (requireConfigured && !whatsappOn && !emailOn) {
    return {
      whatsappSent: false,
      emailSent: false,
      error:
        "Training-code delivery is not configured. Add Termii WhatsApp and/or email template IDs in Vercel.",
    };
  }

  const shared = {
    supabase: input.supabase,
    tenantId: input.tenantId,
    volunteerId: input.volunteerId,
    actorId: input.actorId,
    name: input.name,
    trainingCode: input.trainingCode,
    learnUrl: input.learnUrl,
    requireConfigured,
  };

  const whatsapp = input.phone?.trim()
    ? await sendVolunteerTrainingCodeWhatsApp({ ...shared, phone: input.phone })
    : { sent: false, skipped: true as const };
  const email = input.email?.trim()
    ? await sendVolunteerTrainingCodeEmail({ ...shared, email: input.email })
    : { sent: false, skipped: true as const };

  const error = [whatsapp, email].find((part) => !part.sent && !part.skipped)?.error;
  return {
    whatsappSent: Boolean(whatsapp.sent),
    emailSent: Boolean(email.sent),
    skipped: !whatsapp.sent && !email.sent && !error,
    error,
  };
}
