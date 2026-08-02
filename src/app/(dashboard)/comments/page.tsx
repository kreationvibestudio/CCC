import { getCurrentUser } from "@/lib/auth/session";
import { getCommentsWithResponses, getTeamMembers } from "@/lib/comments/data";
import { CommentsInbox } from "@/components/comments/comments-inbox";

export default async function CommentsPage() {
  const user = await getCurrentUser();
  const tenantId = user!.profile.tenant_id;
  const [comments, team] = await Promise.all([
    getCommentsWithResponses(tenantId),
    getTeamMembers(tenantId),
  ]);
  return <CommentsInbox comments={comments} team={team} />;
}
