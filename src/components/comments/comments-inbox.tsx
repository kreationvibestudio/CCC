"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  assignComment, flagMisinformation, getSuggestedReply,
  replyToComment, resolveComment, classifyAllComments,
} from "@/lib/comments/actions";
import { FacebookSyncButton } from "@/components/social/facebook-sync-button";
import { PageHeader, EmptyState } from "@/components/shared/page-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { formatDate } from "@/lib/utils";
import type { Comment } from "@/types/database";
import type { TeamMember } from "@/lib/comments/data";
import {
  Bot, CheckCircle, Flag, Loader2, MessageSquare, Reply, Sparkles,
} from "lucide-react";
import { toast } from "sonner";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "success" | "warning" | "destructive"> = {
  pending: "warning", assigned: "secondary", replied: "default", resolved: "success", flagged: "destructive",
};

const SENTIMENT_VARIANT: Record<string, "success" | "secondary" | "destructive"> = {
  positive: "success", neutral: "secondary", negative: "destructive",
};

export function CommentsInbox({
  comments,
  team,
}: {
  comments: Comment[];
  team: TeamMember[];
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [platform, setPlatform] = useState("all");
  const [status, setStatus] = useState("all");
  const [sentiment, setSentiment] = useState("all");
  const [replyOpen, setReplyOpen] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [loading, setLoading] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return comments.filter((c) => {
      if (platform !== "all" && c.platform !== platform) return false;
      if (status !== "all" && c.status !== status) return false;
      if (sentiment !== "all" && c.sentiment !== sentiment) return false;
      if (search && !c.content.toLowerCase().includes(search.toLowerCase()) &&
          !c.author_name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [comments, platform, status, sentiment, search]);

  async function handleAction(action: string, commentId: string, extra?: string) {
    setLoading(commentId);
    let result: { error?: string; success?: boolean; suggestion?: string; count?: number; message?: string };
    switch (action) {
      case "resolve": result = await resolveComment(commentId); break;
      case "flag": result = await flagMisinformation(commentId); break;
      case "assign": result = await assignComment(commentId, extra || null); break;
      case "suggest": result = await getSuggestedReply(commentId); break;
      case "classify-all": result = await classifyAllComments(); break;
      default: result = {};
    }
    setLoading(null);

    if (result.error) { toast.error(result.error); return; }
    if (action === "suggest" && result.suggestion) {
      setReplyText(result.suggestion);
      setReplyOpen(commentId);
      return;
    }
    if (action === "classify-all") {
      if (result.count === 0) toast.info(result.message ?? "No comments to classify. Sync Facebook first.");
      else toast.success(`Classified ${result.count} comment${result.count === 1 ? "" : "s"}`);
    }
    else toast.success("Updated");
    router.refresh();
  }

  async function handleReply() {
    if (!replyOpen || !replyText.trim()) return;
    setLoading(replyOpen);
    const result = await replyToComment(replyOpen, replyText.trim());
    setLoading(null);
    if (result.error) { toast.error(result.error); return; }
    toast.success("Reply posted");
    setReplyOpen(null);
    setReplyText("");
    router.refresh();
  }

  const selectClass = "h-9 rounded-md border border-border bg-background px-3 text-sm";

  return (
    <div className="space-y-6">
      <PageHeader title="Unified Comment Management" description="Reply, assign, and monitor all platform comments">
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => handleAction("classify-all", "")} disabled={!!loading}>
            <Sparkles className="mr-1 h-4 w-4" /> AI Classify All
          </Button>
          <FacebookSyncButton />
        </div>
      </PageHeader>

      <div className="flex flex-wrap gap-2">
        <Input placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
        <select className={selectClass} value={platform} onChange={(e) => setPlatform(e.target.value)}>
          <option value="all">All platforms</option>
          <option value="facebook">Facebook</option>
        </select>
        <select className={selectClass} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="all">All statuses</option>
          {["pending", "assigned", "replied", "resolved", "flagged"].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select className={selectClass} value={sentiment} onChange={(e) => setSentiment(e.target.value)}>
          <option value="all">All sentiment</option>
          {["positive", "neutral", "negative"].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <Badge variant="secondary">{filtered.length} comments</Badge>
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="No comments match" description="Sync Facebook or adjust filters" action={<FacebookSyncButton />} />
      ) : (
        <div className="space-y-3">
          {filtered.map((comment) => (
            <Card key={comment.id} className={comment.priority_score >= 80 ? "border-destructive/40" : ""}>
              <CardContent className="pt-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className="capitalize">{comment.platform}</Badge>
                      <span className="font-medium text-sm">{comment.author_name}</span>
                      <span className="text-xs text-muted-foreground">{formatDate(comment.created_at)}</span>
                      {comment.priority_score >= 70 && (
                        <Badge variant="destructive">Priority {comment.priority_score}</Badge>
                      )}
                    </div>
                    <p className="text-sm">{comment.content}</p>
                    <div className="flex flex-wrap gap-1">
                      {comment.sentiment && (
                        <Badge variant={SENTIMENT_VARIANT[comment.sentiment]}>{comment.sentiment}</Badge>
                      )}
                      {comment.issue_topic && comment.issue_topic !== "other" && (
                        <Badge variant="secondary">{comment.issue_topic}</Badge>
                      )}
                      {comment.is_misinformation && <Badge variant="destructive">Misinformation</Badge>}
                      <Badge variant={STATUS_VARIANT[comment.status] ?? "secondary"}>{comment.status}</Badge>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1 shrink-0">
                    <Button size="sm" variant="outline" onClick={() => { setReplyOpen(comment.id); setReplyText(""); }}>
                      <Reply className="h-3 w-3 mr-1" /> Reply
                    </Button>
                    <Button size="sm" variant="outline" disabled={loading === comment.id}
                      onClick={() => handleAction("suggest", comment.id)}>
                      <Bot className="h-3 w-3 mr-1" /> AI Reply
                    </Button>
                    <Button size="sm" variant="outline" disabled={loading === comment.id}
                      onClick={() => handleAction("resolve", comment.id)}>
                      <CheckCircle className="h-3 w-3 mr-1" /> Resolve
                    </Button>
                    <Button size="sm" variant="outline" disabled={loading === comment.id}
                      onClick={() => handleAction("flag", comment.id)}>
                      <Flag className="h-3 w-3 mr-1" /> Flag
                    </Button>
                    {team.length > 0 && (
                      <select className={`${selectClass} h-8 text-xs`} defaultValue=""
                        onChange={(e) => handleAction("assign", comment.id, e.target.value)}>
                        <option value="" disabled>Assign to...</option>
                        {team.map((m) => (
                          <option key={m.id} value={m.id}>{m.full_name}</option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!replyOpen} onOpenChange={(o) => !o && setReplyOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" /> Reply to comment
            </DialogTitle>
          </DialogHeader>
          <textarea
            className="min-h-[120px] w-full rounded-md border border-border bg-background p-3 text-sm"
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            placeholder="Write your reply..."
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => replyOpen && handleAction("suggest", replyOpen)}>
              <Bot className="mr-1 h-4 w-4" /> Suggest with AI
            </Button>
            <Button onClick={handleReply} disabled={!!loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Post Reply
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
