export const TRAINING_REMINDER_DETAIL = "Please finish your required training before the deadline.";

export type ReminderChannels = {
  whatsapp: boolean;
  email: boolean;
  sms: boolean;
};

export function reminderChannels(input: {
  phone?: string | null;
  email?: string | null;
  whatsappOn: boolean;
  emailOn: boolean;
  smsOn: boolean;
}): ReminderChannels {
  const hasPhone = Boolean(input.phone?.trim());
  const hasEmail = Boolean(input.email?.trim());
  return {
    whatsapp: input.whatsappOn && hasPhone,
    email: input.emailOn && hasEmail,
    sms: input.smsOn && hasPhone,
  };
}

export function trainingReminderSms(input: {
  name: string;
  learnUrl: string;
  trainingCode: string;
}): string {
  const first = input.name.trim().split(/\s+/)[0] || "Volunteer";
  return `Hi ${first}, your volunteer training is overdue. Finish it at ${input.learnUrl.trim()} Code: ${input.trainingCode.trim()}`;
}
