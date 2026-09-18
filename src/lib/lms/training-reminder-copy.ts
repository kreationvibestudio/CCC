export const TRAINING_REMINDER_DETAIL = "Please finish your required volunteer training.";

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

export function reminderRecipients<T extends { id: string }>(input: {
  selectedIds?: string[] | null;
  volunteers: T[];
  overdue: T[];
}): { people: T[]; audience: "selected" | "overdue" | "none" } {
  const selected = (input.selectedIds ?? []).filter(Boolean);
  if (selected.length) {
    const want = new Set(selected);
    const people = input.volunteers.filter((volunteer) => want.has(volunteer.id));
    return { people, audience: people.length ? "selected" : "none" };
  }
  if (input.overdue.length) return { people: input.overdue, audience: "overdue" };
  return { people: [], audience: "none" };
}

export const REMINDER_NONE_MESSAGE =
  "Select volunteers in the People table, or wait until someone is overdue.";

export function reminderConfirmCopy(input: {
  selectedCount: number;
  overdueCount: number;
}): { ok: boolean; message: string; audience: "selected" | "overdue" | "none" } {
  if (input.selectedCount > 0) {
    const n = input.selectedCount;
    return {
      ok: true,
      audience: "selected",
      message: `Send training reminders to ${n} selected volunteer${n === 1 ? "" : "s"} via Termii WhatsApp, email, and/or SMS?`,
    };
  }
  if (input.overdueCount > 0) {
    const n = input.overdueCount;
    return {
      ok: true,
      audience: "overdue",
      message: `Send overdue training reminders to ${n} volunteer${n === 1 ? "" : "s"} via Termii WhatsApp, email, and/or SMS?`,
    };
  }
  return { ok: false, audience: "none", message: REMINDER_NONE_MESSAGE };
}

export function trainingReminderSms(input: {
  name: string;
  learnUrl: string;
  trainingCode: string;
}): string {
  const first = input.name.trim().split(/\s+/)[0] || "Volunteer";
  return `Hi ${first}, please finish your volunteer training at ${input.learnUrl.trim()} Code: ${input.trainingCode.trim()}`;
}
