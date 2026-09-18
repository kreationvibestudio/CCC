import { getCurrentUser } from "@/lib/auth/session";
import { getCommentsWithResponses, getTeamMembers } from "@/lib/comments/data";
import { normalizeCommentStatusFilter } from "@/lib/comments/status-filter";
import { CommentsInbox } from "@/components/comments/comments-inbox";

export default async function CommentsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const user = await getCurrentUser();
  const tenantId = user!.profile.tenant_id;
  const { status } = await searchParams;
  const initialStatus = normalizeCommentStatusFilter(status);
  const [comments, team] = await Promise.all([
    getCommentsWithResponses(tenantId),
    getTeamMembers(tenantId),
  ]);
  return <CommentsInbox comments={comments} team={team} initialStatus={initialStatus} />;
}
