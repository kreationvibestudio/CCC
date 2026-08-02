import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader, EmptyState } from "@/components/shared/page-shell";
import { FacebookSyncButton } from "@/components/social/facebook-sync-button";
import { formatDate } from "@/lib/utils";
import type { Comment } from "@/types/database";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "success" | "warning" | "destructive"> = {
  pending: "warning",
  assigned: "secondary",
  replied: "secondary",
  resolved: "success",
  flagged: "destructive",
};

export function CommentsDashboard({ comments }: { comments: Comment[] }) {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Unified Comment Management"
        description="All comments from connected platforms in one inbox"
      >
        <FacebookSyncButton />
      </PageHeader>

      {comments.length === 0 ? (
        <EmptyState
          title="No comments yet"
          description="Sync Facebook first. If posts have comments but none appear here, add the pages_read_user_content permission in Meta Developer Console."
          action={<FacebookSyncButton />}
        />
      ) : (
        <div className="space-y-3">
          {comments.map((comment) => (
            <Card key={comment.id}>
              <CardContent className="flex flex-col gap-2 pt-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="capitalize">{comment.platform}</Badge>
                    <span className="font-medium text-sm">{comment.author_name}</span>
                    <span className="text-xs text-muted-foreground">{formatDate(comment.created_at)}</span>
                  </div>
                  <p className="mt-2 text-sm">{comment.content}</p>
                </div>
                <Badge variant={STATUS_VARIANT[comment.status] ?? "secondary"}>
                  {comment.status}
                </Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
