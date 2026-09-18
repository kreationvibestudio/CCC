export const TRAINING_REMINDER_DETAIL =
  "Please complete your required volunteer training. Sign in with your phone number and training code.";

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

export function uniqueById<T extends { id: string }>(rows: T[]): T[] {
  const seen = new Set<string>();
  const people: T[] = [];
  for (const row of rows) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    people.push(row);
  }
  return people;
}

export function needsTrainingPeople<T extends { id: string }>(input: {
  notStarted: T[];
  overdue: T[];
}): T[] {
  return uniqueById([...input.notStarted, ...input.overdue]);
}

export function reminderRecipients<T extends { id: string }>(input: {
  selectedIds?: string[] | null;
  volunteers: T[];
  notStarted: T[];
  overdue: T[];
}): { people: T[]; audience: "selected" | "needs_training" | "none" } {
  const selected = (input.selectedIds ?? []).filter(Boolean);
  if (selected.length) {
    const want = new Set(selected);
    const people = input.volunteers.filter((volunteer) => want.has(volunteer.id));
    return { people, audience: people.length ? "selected" : "none" };
  }
  const people = needsTrainingPeople({ notStarted: input.notStarted, overdue: input.overdue });
  if (people.length) return { people, audience: "needs_training" };
  return { people: [], audience: "none" };
}

export const REMINDER_NONE_MESSAGE =
  "Select volunteers in the People table, or wait until someone has not started training or is overdue.";

export function reminderConfirmCopy(input: {
  selectedCount: number;
  needsTrainingCount: number;
}): { ok: boolean; message: string; audience: "selected" | "needs_training" | "none" } {
  if (input.selectedCount > 0) {
    const n = input.selectedCount;
    return {
      ok: true,
      audience: "selected",
      message: `Send training reminders to ${n} selected volunteer${n === 1 ? "" : "s"}? Each message includes their phone (login username), training code, and the training link.`,
    };
  }
  if (input.needsTrainingCount > 0) {
    const n = input.needsTrainingCount;
    return {
      ok: true,
      audience: "needs_training",
      message: `Send training reminders to ${n} volunteer${n === 1 ? "" : "s"} who have not started or are overdue? Each message includes their phone (login username), training code, and the training link.`,
    };
  }
  return { ok: false, audience: "none", message: REMINDER_NONE_MESSAGE };
}

export function trainingReminderSms(input: {
  name: string;
  phone?: string | null;
  learnUrl: string;
  trainingCode: string;
}): string {
  const first = input.name.trim().split(/\s+/)[0] || "Volunteer";
  const phone = input.phone?.trim();
  const login = phone
    ? `Username (phone): ${phone} Code: ${input.trainingCode.trim()}`
    : `Code: ${input.trainingCode.trim()}`;
  return `Hi ${first}, you need to complete volunteer training at ${input.learnUrl.trim()} ${login}`;
}

export function trainingReminderLearnUrl(learnUrl: string, phone?: string | null): string {
  const base = learnUrl.trim();
  const number = phone?.trim();
  if (!base || !number) return base;
  try {
    const url = new URL(base);
    url.searchParams.set("phone", number);
    return url.toString();
  } catch {
    const sep = base.includes("?") ? "&" : "?";
    return `${base}${sep}phone=${encodeURIComponent(number)}`;
  }
}
