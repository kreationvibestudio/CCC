import type { SupabaseClient } from "@supabase/supabase-js";
import {
  sendTermiiWhatsAppTemplate,
  termiiWhatsAppConfigured,
} from "@/lib/integrations/termii/client";
import { logLmsActivity } from "./enroll";
import { resolveAppHost, volunteerLearnLoginUrl } from "./learn-url";

export { resolveAppHost, volunteerLearnLoginUrl };

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
