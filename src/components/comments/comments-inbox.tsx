"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  assignComment, flagMisinformation, getSuggestedReply,
  replyToComment, resolveComment, classifyAllComments,
  refreshFacebookCommentAuthors, updateCommentAuthor,
} from "@/lib/comments/actions";
import { FacebookSyncButton } from "@/components/social/facebook-sync-button";
import { FacebookCommenterNamesCard } from "@/components/social/facebook-commenter-names-card";
import { PageHeader, EmptyState } from "@/components/shared/page-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect, nativeSelectClassName } from "@/components/ui/native-select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { cn, formatDate } from "@/lib/utils";
import {
  fillQuickAnswer,
  orderedQuickAnswers,
  recommendedQuickAnswerIds,
} from "@/lib/comments/quick-answers";
import {
  displayFacebookAuthor,
  isPlaceholderFacebookAuthor,
} from "@/lib/integrations/facebook/comment-author";
import type { Comment } from "@/types/database";
import type { TeamMember } from "@/lib/comments/data";
import {
  Bot, CheckCircle, Flag, Loader2, MessageSquare, Pencil, Reply, Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { usePermissions } from "@/components/providers/auth-provider";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "success" | "warning" | "destructive"> = {
  pending: "warning", assigned: "secondary", replied: "default", resolved: "success", flagged: "destructive",
};

const SENTIMENT_VARIANT: Record<string, "success" | "secondary" | "destructive"> = {
  positive: "success", neutral: "secondary", negative: "destructive",
};

export function CommentsInbox({
  comments,
  team,
  initialStatus = "all",
}: {
  comments: Comment[];
  team: TeamMember[];
  initialStatus?: string;
}) {
  const router = useRouter();
  const { canWrite } = usePermissions();
  const [search, setSearch] = useState("");
  const [platform, setPlatform] = useState("all");
  const [status, setStatus] = useState(initialStatus);
  const [sentiment, setSentiment] = useState("all");
  const [replyOpen, setReplyOpen] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [selectedQuickAnswer, setSelectedQuickAnswer] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameText, setRenameText] = useState("");

  const hiddenAuthors = comments.filter(
    (comment) => comment.platform === "facebook" && isPlaceholderFacebookAuthor(comment.author_name)
  ).length;

  useEffect(() => {
    if (!canWrite || hiddenAuthors === 0) return;
    let cancelled = false;
    refreshFacebookCommentAuthors().then((result) => {
      if (cancelled || "error" in result) return;
      if (result.updated > 0) {
        toast.success(
          `Filled ${result.updated} commenter name${result.updated === 1 ? "" : "s"} from Facebook`
        );
        router.refresh();
      }
    });
    return () => {
      cancelled = true;
    };
  }, [canWrite, hiddenAuthors, router]);

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
    let result: {
      error?: string;
      success?: boolean;
      suggestion?: string;
      count?: number;
      remaining?: number;
      message?: string;
    };
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
      setSelectedQuickAnswer(null);
      setReplyOpen(commentId);
      return;
    }
    if (action === "classify-all") {
      if (result.count === 0) {
        toast.info(result.message ?? "No comments to classify. Sync Facebook first.");
      } else if (result.remaining) {
        // One AI call per comment, so a large inbox takes several runs.
        toast.success(
          `Classified ${result.count} comment${result.count === 1 ? "" : "s"}. ` +
            `${result.remaining.toLocaleString()} still unclassified — click again to continue.`
        );
      } else {
        toast.success(`Classified ${result.count} comment${result.count === 1 ? "" : "s"}`);
      }
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
    setSelectedQuickAnswer(null);
    router.refresh();
  }

  async function handleRename() {
    if (!renameId || !renameText.trim()) return;
    setLoading(renameId);
    const result = await updateCommentAuthor(renameId, renameText.trim());
    setLoading(null);
    if (result.error) { toast.error(result.error); return; }
    toast.success("Commenter name saved");
    setRenameId(null);
    setRenameText("");
    router.refresh();
  }

  const replyComment = comments.find((comment) => comment.id === replyOpen) ?? null;
  const quickAnswers = replyComment ? orderedQuickAnswers(replyComment) : [];
  const recommendedIds = replyComment
    ? new Set(recommendedQuickAnswerIds(replyComment))
    : new Set<string>();

  const selectClass = cn(nativeSelectClassName, "w-auto");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Unified Comment Management"
        description={canWrite ? "Reply, assign, and monitor all platform comments" : "View and monitor all platform comments"}
      >
        {canWrite ? (
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => handleAction("classify-all", "")} disabled={!!loading}>
            <Sparkles className="mr-1 h-4 w-4" /> AI Classify All
          </Button>
          <FacebookSyncButton />
        </div>
        ) : null}
      </PageHeader>

      <div className="flex flex-wrap gap-2">
        <Input placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
        <NativeSelect className={selectClass} value={platform} onChange={(e) => setPlatform(e.target.value)}>
          <option value="all">All platforms</option>
          <option value="facebook">Facebook</option>
        </NativeSelect>
        <NativeSelect className={selectClass} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="all">All statuses</option>
          {["pending", "assigned", "replied", "resolved", "flagged"].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </NativeSelect>
        <NativeSelect className={selectClass} value={sentiment} onChange={(e) => setSentiment(e.target.value)}>
          <option value="all">All sentiment</option>
          {["positive", "neutral", "negative"].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </NativeSelect>
        <Badge variant="secondary">{filtered.length} comments</Badge>
      </div>

      <FacebookCommenterNamesCard hiddenCount={hiddenAuthors} canWrite={canWrite} />

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
                      <span className="font-medium text-sm">
                        {displayFacebookAuthor(comment.author_name)}
                      </span>
                      {canWrite && comment.platform === "facebook" && isPlaceholderFacebookAuthor(comment.author_name) ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 px-1 text-xs"
                          onClick={() => {
                            setRenameId(comment.id);
                            setRenameText("");
                          }}
                        >
                          <Pencil className="h-3 w-3 mr-1" /> Set name
                        </Button>
                      ) : null}
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
                  {canWrite ? (
                  <div className="flex flex-wrap gap-1 shrink-0">
                    <Button size="sm" variant="outline" onClick={() => {
                      setReplyOpen(comment.id);
                      setReplyText("");
                      setSelectedQuickAnswer(null);
                    }}>
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
                      <NativeSelect className="h-8 w-auto text-xs" defaultValue=""
                        onChange={(e) => handleAction("assign", comment.id, e.target.value)}>
                        <option value="" disabled>Assign to...</option>
                        {team.map((m) => (
                          <option key={m.id} value={m.id}>{m.full_name}</option>
                        ))}
                      </NativeSelect>
                    )}
                  </div>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!replyOpen} onOpenChange={(o) => {
        if (!o) {
          setReplyOpen(null);
          setSelectedQuickAnswer(null);
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" /> Reply to comment
            </DialogTitle>
          </DialogHeader>
          {replyComment ? (
            <blockquote className="rounded-md border bg-muted/50 p-3 text-sm">
              <p className="mb-1 text-xs font-medium text-muted-foreground">
                {displayFacebookAuthor(replyComment.author_name)}
              </p>
              <p className="whitespace-pre-wrap">{replyComment.content}</p>
            </blockquote>
          ) : null}
          {replyComment ? (
            <div className="space-y-2">
              <div>
                <p className="text-sm font-medium">Quick answers</p>
                <p className="text-xs text-muted-foreground">
                  Pick one that fits, then edit if you need to. If none of these work, use AI — it reads this comment and drafts a matching reply.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {quickAnswers.map((answer) => {
                  const selected = selectedQuickAnswer === answer.id;
                  const suggested = recommendedIds.has(answer.id);
                  return (
                    <Button
                      key={answer.id}
                      type="button"
                      size="sm"
                      variant={selected ? "default" : "outline"}
                      className="h-auto max-w-full whitespace-normal px-3 py-1.5 text-left"
                      onClick={() => {
                        setReplyText(fillQuickAnswer(
                          answer.body,
                          isPlaceholderFacebookAuthor(replyComment.author_name) ? "" : replyComment.author_name
                        ));
                        setSelectedQuickAnswer(answer.id);
                      }}
                    >
                      {answer.label}
                      {suggested && !selected ? (
                        <span className="ml-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                          Suggested
                        </span>
                      ) : null}
                    </Button>
                  );
                })}
              </div>
            </div>
          ) : null}
          <textarea
            className="min-h-[120px] w-full rounded-md border border-border bg-background p-3 text-sm"
            value={replyText}
            onChange={(e) => {
              setReplyText(e.target.value);
              setSelectedQuickAnswer(null);
            }}
            placeholder="Write your reply, or pick a quick answer above..."
          />
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              disabled={!!loading || !replyOpen}
              onClick={() => replyOpen && handleAction("suggest", replyOpen)}
            >
              {loading === replyOpen ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Bot className="mr-1 h-4 w-4" />}
              Suggest with AI
            </Button>
            <Button onClick={handleReply} disabled={!!loading || !replyText.trim()}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Post Reply
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!renameId} onOpenChange={(o) => !o && setRenameId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set commenter name</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Facebook hid this visitor&apos;s name. Type it from the Page if you can see it there.
          </p>
          <Input
            value={renameText}
            onChange={(e) => setRenameText(e.target.value)}
            placeholder="e.g. Ada Okojie"
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setRenameId(null)}>Cancel</Button>
            <Button onClick={handleRename} disabled={!!loading || !renameText.trim()}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save name
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
