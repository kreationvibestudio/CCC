import type { SupabaseClient } from "@supabase/supabase-js";
import {
  sendTermiiSms,
  termiiEmailConfigured,
  termiiSmsConfigured,
  termiiWhatsAppConfigured,
} from "@/lib/integrations/termii/client";
import { logLmsActivity } from "./enroll";
import { sendVolunteerTrainingCodes } from "./send-training-code";
import {
  TRAINING_REMINDER_DETAIL,
  reminderChannels,
  trainingReminderLearnUrl,
  trainingReminderSms,
} from "./training-reminder-copy";

export { TRAINING_REMINDER_DETAIL, reminderChannels, trainingReminderSms };

export type TrainingReminderSendResult = {
  whatsappSent: boolean;
  emailSent: boolean;
  smsSent: boolean;
  skipped?: boolean;
  error?: string;
};

export function termiiReminderDeliveryConfigured() {
  return termiiWhatsAppConfigured() || termiiEmailConfigured() || termiiSmsConfigured();
}

export async function sendVolunteerTrainingReminder(input: {
  supabase: SupabaseClient;
  tenantId: string;
  volunteerId: string;
  actorId?: string | null;
  phone?: string | null;
  email?: string | null;
  name: string;
  trainingCode: string;
  learnUrl: string;
}): Promise<TrainingReminderSendResult> {
  if (!termiiReminderDeliveryConfigured()) {
    return {
      whatsappSent: false,
      emailSent: false,
      smsSent: false,
      error:
        "No reminder channel is configured. Add Termii WhatsApp, email, and/or SMS (TERMII_API_KEY + TERMII_SENDER_ID) in Vercel.",
    };
  }

  const channels = reminderChannels({
    phone: input.phone,
    email: input.email,
    whatsappOn: termiiWhatsAppConfigured(),
    emailOn: termiiEmailConfigured(),
    smsOn: termiiSmsConfigured(),
  });
  if (!channels.whatsapp && !channels.email && !channels.sms) {
    return {
      whatsappSent: false,
      emailSent: false,
      smsSent: false,
      skipped: true,
      error: "This volunteer has no phone or email for a reminder.",
    };
  }

  const learnUrl = trainingReminderLearnUrl(input.learnUrl.trim(), input.phone);
  const trainingCode = input.trainingCode.trim();
  if (!learnUrl) {
    return {
      whatsappSent: false,
      emailSent: false,
      smsSent: false,
      error: "Training login URL is missing. Set NEXT_PUBLIC_APP_URL.",
    };
  }
  if (!trainingCode) {
    return {
      whatsappSent: false,
      emailSent: false,
      smsSent: false,
      error: "This volunteer does not have a training code yet.",
    };
  }

  let whatsappSent = false;
  let emailSent = false;
  let codesError: string | undefined;
  if (channels.whatsapp || channels.email) {
    const codes = await sendVolunteerTrainingCodes({
      supabase: input.supabase,
      tenantId: input.tenantId,
      volunteerId: input.volunteerId,
      actorId: input.actorId,
      phone: channels.whatsapp ? input.phone : null,
      email: channels.email ? input.email : null,
      name: input.name,
      trainingCode,
      learnUrl,
      requireConfigured: false,
    });
    whatsappSent = codes.whatsappSent;
    emailSent = codes.emailSent;
    if (!whatsappSent && !emailSent && codes.error) codesError = codes.error;
  }

  let smsSent = false;
  let smsError: string | undefined;
  if (channels.sms && input.phone?.trim()) {
    const result = await sendTermiiSms(
      input.phone,
      trainingReminderSms({
        name: input.name,
        phone: input.phone,
        learnUrl,
        trainingCode,
      })
    );
    if (result.ok) {
      smsSent = true;
      await logLmsActivity(input.supabase, {
        tenantId: input.tenantId,
        volunteerId: input.volunteerId,
        actorId: input.actorId ?? null,
        action: "training.reminder_sms",
        detail: "Training reminder sent by SMS with phone and training code",
        metadata: { message_id: result.messageId ?? null, channel: "sms" },
      });
    } else {
      smsError = result.error ?? "Could not send the SMS reminder.";
    }
  }

  const sent = whatsappSent || emailSent || smsSent;
  if (!sent) {
    return {
      whatsappSent,
      emailSent,
      smsSent,
      error: codesError || smsError || "Could not send the training reminder.",
    };
  }

  await logLmsActivity(input.supabase, {
    tenantId: input.tenantId,
    volunteerId: input.volunteerId,
    actorId: input.actorId ?? null,
    action: "training.reminder",
    detail: TRAINING_REMINDER_DETAIL,
    metadata: {
      source: "hq_bulk",
      whatsapp: whatsappSent,
      email: emailSent,
      sms: smsSent,
    },
  });
  return { whatsappSent, emailSent, smsSent };
}
