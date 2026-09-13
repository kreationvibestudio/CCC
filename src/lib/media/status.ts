import type { MediaContentStatus } from "../../types/database.ts";

export const MEDIA_TRANSITIONS: Record<MediaContentStatus, MediaContentStatus[]> = {
  draft: ["approved", "killed"],
  approved: ["scheduled", "draft", "posted", "killed"],
  scheduled: ["posted", "approved", "killed"],
  posted: [],
  killed: ["draft"],
};

export function canTransition(
  from: MediaContentStatus,
  to: MediaContentStatus
): boolean {
  return MEDIA_TRANSITIONS[from].includes(to);
}

export function transitionError(
  from: MediaContentStatus,
  to: MediaContentStatus
): string | null {
  if (from === to) return null;
  if (!canTransition(from, to)) {
    return `Cannot move a ${from} post to ${to}`;
  }
  return null;
}

export type StatusPatch = {
  status: MediaContentStatus;
  scheduled_at?: string | null;
  posted_at?: string | null;
  updated_at: string;
};

export function statusPatch(
  from: MediaContentStatus,
  to: MediaContentStatus,
  extra?: { scheduledAt?: string | null; now?: Date }
): { ok: true; patch: StatusPatch } | { ok: false; error: string } {
  const error = transitionError(from, to);
  if (error) return { ok: false, error };

  const now = extra?.now ?? new Date();
  const iso = now.toISOString();
  const patch: StatusPatch = { status: to, updated_at: iso };

  if (to === "scheduled") {
    const scheduledAt = extra?.scheduledAt?.trim();
    if (!scheduledAt) return { ok: false, error: "Pick a schedule time before moving to scheduled" };
    const when = new Date(scheduledAt);
    if (Number.isNaN(when.getTime())) return { ok: false, error: "Schedule time is not a valid date" };
    patch.scheduled_at = when.toISOString();
    patch.posted_at = null;
  }

  if (to === "posted") {
    patch.posted_at = iso;
  }

  if (to === "draft" || to === "approved") {
    if (from === "killed" || from === "scheduled") {
      patch.scheduled_at = to === "approved" ? extra?.scheduledAt ?? null : null;
    }
  }

  if (to === "killed") {
    patch.posted_at = null;
  }

  return { ok: true, patch };
}
