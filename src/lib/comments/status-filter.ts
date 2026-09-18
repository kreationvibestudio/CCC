/** Open queue: still needs HQ attention. */
export const OPEN_COMMENT_STATUSES = ["pending", "assigned", "flagged"] as const;

/** Done for the inbox — kept, but off the working queue. */
export const HANDLED_COMMENT_STATUSES = ["replied", "resolved"] as const;

export type CommentStatusFilter =
  | "needs_response"
  | "all"
  | "pending"
  | "assigned"
  | "replied"
  | "resolved"
  | "flagged";

export function normalizeCommentStatusFilter(raw: string | undefined | null): CommentStatusFilter {
  const value = (raw ?? "").trim().toLowerCase();
  if (
    value === "all" ||
    value === "pending" ||
    value === "assigned" ||
    value === "replied" ||
    value === "resolved" ||
    value === "flagged" ||
    value === "needs_response"
  ) {
    return value;
  }
  // Default working queue — not "all", so replied/resolved stay out of the way.
  return "needs_response";
}

export function commentMatchesStatusFilter(status: string, filter: CommentStatusFilter): boolean {
  if (filter === "all") return true;
  if (filter === "needs_response") {
    return (OPEN_COMMENT_STATUSES as readonly string[]).includes(status);
  }
  return status === filter;
}

export function isHandledCommentStatus(status: string): boolean {
  return (HANDLED_COMMENT_STATUSES as readonly string[]).includes(status);
}
