"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Bot,
  CheckCircle,
  Copy,
  FileText,
  Heart,
  Loader2,
  MessageSquare,
  Plus,
  Reply,
  Share2,
  Sparkles,
} from "lucide-react";
import { FacebookSyncButton } from "@/components/social/facebook-sync-button";
import { MediaSchemaSetup } from "@/components/media/media-schema-setup";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { assignComment, getSuggestedReply, replyToComment } from "@/lib/comments/actions";
import {
  createMediaContent,
  draftFromIssue,
  markMediaPosted,
  updateMediaStatus,
} from "@/lib/media/actions";
import { unpackTalkingPoints } from "@/lib/media/draft-fallback";
import { PICKABLE_TOPICS, topicLabel } from "@/lib/media/topics";
import { MEDIA_TONES, MEDIA_TONE_COPY, type MediaTone } from "@/lib/media/tones";
import { cn, formatDate, formatNumber } from "@/lib/utils";
import { displayFacebookAuthor } from "@/lib/integrations/facebook/comment-author";
import type { MediaCommandData } from "@/lib/media/data";
import type { Comment, MediaContent } from "@/types/database";
import type { TeamMember } from "@/lib/comments/data";

async function copyText(text: string, ok: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(ok);
  } catch {
    toast.error("Could not copy. Select the text and copy it yourself.");
  }
}

export function MediaCommand({
  data,
  canManage,
  canReply,
}: {
  data: MediaCommandData;
  canManage: boolean;
  canReply: boolean;
}) {
  const toPost = data.items.filter(
    (item) => item.status === "draft" || item.status === "approved" || item.status === "scheduled"
  );
  const heat = data.brief.topIssues.filter((topic) => topic && topic !== "other");

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 border-b border-border pb-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">Media</h1>
          <p className="text-base font-medium">{data.brief.mediaLine}</p>
          <p className="text-sm text-muted-foreground">
            Reply first. Then pick the beat HQ wants to own — comment heat is only a hint.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={() => copyText(data.brief.huddleText, "Copied the huddle for WhatsApp")}>
            <Copy className="h-4 w-4" /> Copy huddle
          </Button>
          <FacebookSyncButton />
        </div>
      </header>

      {data.schemaMissing ? (
        <MediaSchemaSetup message="One SQL apply unlocks saving drafts. Replies and the huddle already work." />
      ) : null}

      <section className="space-y-3" aria-labelledby="reply-now">
        <StepHeading
          n={1}
          title="Reply now"
          titleId="reply-now"
          hint={
            data.mustAct.length === 0
              ? "Inbox is clear."
              : `${data.mustAct.length} comment${data.mustAct.length === 1 ? "" : "s"} need a reply — start with rumours.`
          }
          action={
            <Button variant="ghost" size="sm" asChild>
              <Link href="/comments">Full inbox</Link>
            </Button>
          }
        />
        {data.mustAct.length === 0 ? (
          <Card>
            <CardContent className="py-6 text-sm text-muted-foreground">
              Nothing urgent. Check Facebook after the next sync.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {data.mustAct.map((comment) => (
              <MustActRow key={comment.id} comment={comment} team={data.team} canReply={canReply} />
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3" aria-labelledby="next-post">
        <StepHeading
          n={2}
          title="Choose what Edo reads next"
          titleId="next-post"
          hint="Employment or any other heat topic appears because comments keep mentioning it — not because HQ chose it. Pick the beat, pick a tone, then write a Facebook caption plus a short article."
        />

        <AgendaDesk
          heat={heat}
          issueHeat={data.issueHeat}
          misinfo={data.brief.misinfo}
          canManage={canManage}
          disabled={data.schemaMissing}
        />

        {toPost.length > 0 ? (
          <div className="space-y-2">
            <p className="text-sm font-medium">Ready to copy</p>
            {toPost.map((item) => (
              <DraftRow key={item.id} item={item} canManage={canManage} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No drafts yet. Pick a beat above and write.</p>
        )}
      </section>

      <section className="space-y-3" aria-labelledby="what-landed">
        <StepHeading
          n={3}
          title="What landed"
          titleId="what-landed"
          hint="Last Facebook posts. Repeat what worked."
          action={
            <Button variant="ghost" size="sm" asChild>
              <Link href="/social">All posts</Link>
            </Button>
          }
        />
        {data.lastPosts.length === 0 ? (
          <Card>
            <CardContent className="py-6 text-sm text-muted-foreground">
              Sync Facebook to see what is landing.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {data.lastPosts.slice(0, 4).map((post) => (
              <Card key={post.id}>
                <CardContent className="space-y-2 py-4">
                  <p className="text-sm">{post.content || "(no caption)"}</p>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    {post.posted_at ? <span>{formatDate(post.posted_at)}</span> : null}
                    <span className="inline-flex items-center gap-1"><Heart className="h-3 w-3" /> {formatNumber(post.likes)}</span>
                    <span className="inline-flex items-center gap-1"><MessageSquare className="h-3 w-3" /> {formatNumber(post.comments_count)}</span>
                    <span className="inline-flex items-center gap-1"><Share2 className="h-3 w-3" /> {formatNumber(post.shares)}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function StepHeading({
  n,
  title,
  titleId,
  hint,
  action,
}: {
  n: number;
  title: string;
  titleId: string;
  hint: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex min-w-0 items-start gap-3">
        <span
          aria-hidden
          className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground"
        >
          {n}
        </span>
        <div className="min-w-0">
          <h2 id={titleId} className="text-lg font-semibold">
            {title}
          </h2>
          <p className="text-sm text-muted-foreground">{hint}</p>
        </div>
      </div>
      {action}
    </div>
  );
}

function AgendaDesk({
  heat,
  issueHeat,
  misinfo,
  canManage,
  disabled,
}: {
  heat: string[];
  issueHeat: { topic: string; count: number }[];
  misinfo: number;
  canManage: boolean;
  disabled: boolean;
}) {
  const router = useRouter();
  const [topic, setTopic] = useState("");
  const [tone, setTone] = useState<MediaTone>("agenda");
  const [pending, start] = useTransition();
  const heatCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of issueHeat) {
      if (row.topic) map.set(row.topic, row.count);
    }
    return map;
  }, [issueHeat]);

  return (
    <Card>
      <CardContent className="space-y-5 py-5">
        {heat.length > 0 ? (
          <p className="text-sm text-muted-foreground">
            Comment heat right now:{" "}
            <span className="font-medium text-foreground">
              {heat.map((item) => topicLabel(item)).join(", ")}
            </span>
            . That is what people are writing — not what you must post.
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            No comment heat yet. Pick the beat HQ wants Edo to argue about this week.
          </p>
        )}

        <div className="space-y-2">
          <p className="text-sm font-medium">Beat</p>
          <div className="flex flex-wrap gap-2">
            {PICKABLE_TOPICS.map((item) => {
              const selected = topic === item;
              const count = heatCounts.get(item) ?? 0;
              const isHeat = heat.includes(item);
              return (
                <button
                  key={item}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setTopic(item)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors",
                    selected
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background hover:bg-accent"
                  )}
                >
                  {topicLabel(item)}
                  {isHeat ? (
                    <span
                      className={cn(
                        "rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                        selected ? "bg-primary-foreground/20" : "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                      )}
                    >
                      heat{count > 0 ? ` ${count}` : ""}
                    </span>
                  ) : null}
                </button>
              );
            })}
            {misinfo > 0 ? (
              <button
                type="button"
                aria-pressed={topic === "fact-check"}
                onClick={() => setTopic("fact-check")}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors",
                  topic === "fact-check"
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background hover:bg-accent"
                )}
              >
                Fact-check
              </button>
            ) : null}
          </div>
        </div>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Tone</legend>
          <div className="grid gap-2 sm:grid-cols-3">
            {MEDIA_TONES.map((item) => {
              const selected = tone === item;
              return (
                <button
                  key={item}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setTone(item)}
                  className={cn(
                    "rounded-lg border px-3 py-2 text-left transition-colors",
                    selected
                      ? "border-primary bg-primary/5"
                      : "border-border bg-background hover:bg-accent"
                  )}
                >
                  <span className="block text-sm font-medium">{MEDIA_TONE_COPY[item].label}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {MEDIA_TONE_COPY[item].hint}
                  </span>
                </button>
              );
            })}
          </div>
        </fieldset>

        <div className="flex flex-wrap gap-2">
          {canManage ? (
            <Button
              disabled={disabled || pending || !topic}
              onClick={() => {
                start(async () => {
                  try {
                    const result = await draftFromIssue(topic, tone);
                    if (result.error) {
                      toast.error(result.error);
                      return;
                    }
                    toast.success("Draft ready — copy the Facebook caption or the article");
                    router.refresh();
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : "Could not write that draft.");
                  }
                });
              }}
            >
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Write post + article
            </Button>
          ) : null}
          <WriteOwnPost canManage={canManage} disabled={disabled} />
        </div>
      </CardContent>
    </Card>
  );
}

function WriteOwnPost({ canManage, disabled }: { canManage: boolean; disabled: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [body, setBody] = useState("");
  const [topic, setTopic] = useState("");

  if (!canManage) return null;

  return (
    <>
      <Button variant="outline" disabled={disabled} onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" /> Write your own
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Write your own post</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Facebook caption. No invented promises.</p>
          <div className="space-y-1">
            <Label htmlFor="own-topic">Topic</Label>
            <NativeSelect id="own-topic" value={topic} onChange={(e) => setTopic(e.target.value)}>
              <option value="">Pick a topic</option>
              {PICKABLE_TOPICS.map((item) => (
                <option key={item} value={item}>{topicLabel(item)}</option>
              ))}
            </NativeSelect>
          </div>
          <textarea
            className="min-h-[140px] w-full rounded-md border border-border bg-background p-3 text-sm"
            value={body}
            maxLength={720}
            onChange={(e) => setBody(e.target.value)}
            placeholder="The question Edo should be asking this week…"
          />
          <p className="text-xs text-muted-foreground">{body.length}/720</p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              disabled={pending || !body.trim()}
              onClick={() => {
                start(async () => {
                  const title = topic ? `On ${topicLabel(topic)}` : "Campaign post";
                  const result = await createMediaContent({
                    title,
                    body: body.trim(),
                    issue_topic: topic || null,
                  });
                  if (result.error) {
                    toast.error(result.error);
                    return;
                  }
                  toast.success("Draft saved");
                  setBody("");
                  setOpen(false);
                  router.refresh();
                });
              }}
            >
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Save draft
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function DraftRow({ item, canManage }: { item: MediaContent; canManage: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const extras = unpackTalkingPoints(item.talking_points);
  const toneLabel = extras.tone ? MEDIA_TONE_COPY[extras.tone].label : null;

  return (
    <Card>
      <CardContent className="space-y-3 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium text-sm">{item.title}</p>
          {item.issue_topic ? <Badge variant="secondary">{topicLabel(item.issue_topic)}</Badge> : null}
          {toneLabel ? <Badge variant="outline">{toneLabel}</Badge> : null}
        </div>
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Facebook caption</p>
          <p className="text-sm whitespace-pre-wrap">{item.body}</p>
        </div>
        {extras.article ? (
          <div className="space-y-1 rounded-md border border-border bg-muted/40 p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Article</p>
            <p className="text-sm whitespace-pre-wrap">{extras.article}</p>
          </div>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => copyText(item.body, "Copied — paste into Facebook")}>
            <Copy className="h-3 w-3" /> Copy for Facebook
          </Button>
          {extras.article ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => copyText(extras.article ?? "", "Copied the article")}
            >
              <FileText className="h-3 w-3" /> Copy article
            </Button>
          ) : null}
          {canManage ? (
            <>
              <Button
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() => {
                  start(async () => {
                    const result = await markMediaPosted(item.id);
                    if (result.error) {
                      toast.error(result.error);
                      return;
                    }
                    toast.success("Marked posted");
                    router.refresh();
                  });
                }}
              >
                <CheckCircle className="h-3 w-3" /> It’s posted
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={pending}
                onClick={() => {
                  start(async () => {
                    const result = await updateMediaStatus(item.id, "killed");
                    if (result.error) {
                      toast.error(result.error);
                      return;
                    }
                    toast.success("Removed");
                    router.refresh();
                  });
                }}
              >
                Remove
              </Button>
            </>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function MustActRow({
  comment,
  team,
  canReply,
}: {
  comment: Comment;
  team: TeamMember[];
  canReply: boolean;
}) {
  const router = useRouter();
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [loading, setLoading] = useState<string | null>(null);
  const urgent = comment.is_misinformation || comment.status === "flagged";

  async function suggest() {
    setLoading("suggest");
    const result = await getSuggestedReply(comment.id);
    setLoading(null);
    if ("error" in result && result.error) {
      toast.error(result.error);
      return;
    }
    if ("suggestion" in result && result.suggestion) {
      setReplyText(result.suggestion);
      setReplyOpen(true);
    }
  }

  async function sendReply() {
    setLoading("reply");
    const result = await replyToComment(comment.id, replyText);
    setLoading(null);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Reply posted");
    setReplyOpen(false);
    router.refresh();
  }

  return (
    <Card className={urgent ? "border-destructive/40" : undefined}>
      <CardContent className="space-y-3 py-4">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-sm font-medium text-foreground">{displayFacebookAuthor(comment.author_name)}</span>
          {comment.is_misinformation ? <Badge variant="destructive">Rumour</Badge> : null}
          {comment.issue_topic && comment.issue_topic !== "other" ? (
            <Badge variant="secondary">{topicLabel(comment.issue_topic)}</Badge>
          ) : null}
        </div>
        <p className="text-sm">{comment.content}</p>
        {canReply ? (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => { setReplyOpen(true); setReplyText(""); }}>
              <Reply className="h-3 w-3" /> Reply
            </Button>
            <Button size="sm" variant="outline" disabled={loading === "suggest"} onClick={suggest}>
              {loading === "suggest" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Bot className="h-3 w-3" />}
              Suggest reply
            </Button>
            {team.length > 0 ? (
              <NativeSelect
                className="h-8 w-auto text-xs"
                defaultValue=""
                onChange={(e) => {
                  assignComment(comment.id, e.target.value).then((result) => {
                    if (result.error) toast.error(result.error);
                    else {
                      toast.success("Assigned");
                      router.refresh();
                    }
                  });
                }}
              >
                <option value="" disabled>Hand to…</option>
                {team.map((member) => (
                  <option key={member.id} value={member.id}>{member.full_name}</option>
                ))}
              </NativeSelect>
            ) : null}
          </div>
        ) : (
          <Button size="sm" variant="outline" asChild>
            <Link href="/comments">Open inbox</Link>
          </Button>
        )}
      </CardContent>

      <Dialog open={replyOpen} onOpenChange={setReplyOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reply</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{comment.content}</p>
          <textarea
            className="min-h-[120px] w-full rounded-md border border-border bg-background p-3 text-sm"
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={suggest} disabled={!!loading}>Suggest reply</Button>
            <Button onClick={sendReply} disabled={!!loading || !replyText.trim()}>
              {loading === "reply" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Send
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
