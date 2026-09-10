export type TrainingStatus = "pending" | "in_progress" | "completed";

export type TrainingListFilter = "all" | "needs_briefing" | "trained";

const STATUSES: readonly TrainingStatus[] = ["pending", "in_progress", "completed"];

export function isTrainingStatus(value: unknown): value is TrainingStatus {
  return typeof value === "string" && (STATUSES as readonly string[]).includes(value);
}

/** Anyone not marked completed still needs the campaign briefing. */
export function needsBriefing(status: string | null | undefined): boolean {
  return status !== "completed";
}

export function trainingStatusLabel(status: string | null | undefined): string {
  if (status === "completed") return "Trained";
  if (status === "in_progress") return "In progress";
  return "Pending";
}

export function trainingBadgeVariant(
  status: string | null | undefined
): "warning" | "info" | "success" {
  if (status === "completed") return "success";
  if (status === "in_progress") return "info";
  return "warning";
}

export function countTraining(volunteers: Array<{ training_status: string }>) {
  const trained = volunteers.filter((v) => v.training_status === "completed").length;
  return {
    total: volunteers.length,
    trained,
    pending: volunteers.length - trained,
  };
}

export function filterByTraining<T extends { training_status: string }>(
  volunteers: T[],
  filter: TrainingListFilter
): T[] {
  if (filter === "trained") return volunteers.filter((v) => v.training_status === "completed");
  if (filter === "needs_briefing") return volunteers.filter((v) => needsBriefing(v.training_status));
  return volunteers;
}

export function applyTrainingTransition(input: {
  next: TrainingStatus;
  notes?: string | null;
  existingTrainedAt?: string | null;
  now?: Date;
}): {
  training_status: TrainingStatus;
  trained_at: string | null;
  training_notes?: string | null;
} {
  const now = input.now ?? new Date();
  const patch: {
    training_status: TrainingStatus;
    trained_at: string | null;
    training_notes?: string | null;
  } = {
    training_status: input.next,
    trained_at:
      input.next === "completed"
        ? input.existingTrainedAt ?? now.toISOString()
        : null,
  };
  if (input.notes !== undefined) {
    patch.training_notes = input.notes?.trim() || null;
  }
  return patch;
}

export function formatTrainedAt(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" });
}
