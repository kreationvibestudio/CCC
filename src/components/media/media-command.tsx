"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Bot,
  CheckCircle,
  Copy,
  Heart,
  Loader2,
  Megaphone,
  MessageSquare,
  Reply,
  Share2,
  Sparkles,
} from "lucide-react";
import { PageHeader, StatCard } from "@/components/shared/page-shell";
import { FacebookSyncButton } from "@/components/social/facebook-sync-button";
import { MediaSchemaSetup } from "@/components/media/media-schema-setup";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  publishMediaToFacebook,
  updateMediaStatus,
} from "@/lib/media/actions";
import { MEDIA_TRANSITIONS } from "@/lib/media/status";
import { ISSUE_TOPICS } from "@/lib/media/topics";
import { formatDate, formatNumber } from "@/lib/utils";
import { displayFacebookAuthor } from "@/lib/integrations/facebook/comment-author";
import type { MediaCommandData } from "@/lib/media/data";
import type { Comment, MediaContent, MediaContentStatus } from "@/types/database";
import type { TeamMember } from "@/lib/comments/data";

const STATUS_VARIANT: Record<MediaContentStatus, "secondary" | "info" | "warning" | "success" | "destructive"> = {
  draft: "secondary",
  approved: "info",
  scheduled: "warning",
  posted: "success",
  killed: "destructive",
};

const CALL_VARIANT: Record<string, "destructive" | "warning" | "secondary"> = {
  critical: "destructive",
  high: "warning",
  watch: "secondary",
};

async function copyText(text: string, ok: string) {
  await navigator.clipboard.writeText(text);
  toast.success(ok);
}

export function MediaCommand({
  data,
  canManage,
  canReply,
  initialTab = "war-room",
}: {
  data: MediaCommandData;
  canManage: boolean;
  canReply: boolean;
  initialTab?: string;
}) {
  const tab = initialTab === "calendar" || initialTab === "brief" ? initialTab : "war-room";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Media Command"
        description="Run the shift: comments and posts in the war room, a week of drafts, and a huddle brief you can paste into WhatsApp."
      >
        <div className="flex flex-wrap gap-2">
          <FacebookSyncButton />
          <Button variant="outline" asChild>
            <Link href="/comments">Comments inbox</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/social">Social</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/sentiment">Sentiment</Link>
          </Button>
        </div>
      </PageHeader>

      {data.schemaMissing ? (
        <MediaSchemaSetup message="The calendar table is not on this database yet. War room and brief still work from Facebook comments and posts." />
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Must act" value={data.mustAct.length} change="Pending, flagged, or misinfo" icon={Megaphone} />
        <StatCard title="Pending" value={data.brief.pending} change="Still waiting on a reply" icon={MessageSquare} />
        <StatCard title="Misinfo" value={data.brief.misinfo} change="Open flags" />
        <StatCard title="This week’s drafts" value={data.items.filter((item) => item.status !== "killed").length} change="Calendar items" />
      </div>

      <Tabs defaultValue={tab}>
        <TabsList>
          <TabsTrigger value="war-room">War room</TabsTrigger>
          <TabsTrigger value="calendar">Calendar</TabsTrigger>
          <TabsTrigger value="brief">Brief</TabsTrigger>
        </TabsList>
        <TabsContent value="war-room">
          <WarRoom data={data} canReply={canReply} />
        </TabsContent>
        <TabsContent value="calendar">
          <CalendarPane
            items={data.items}
            topIssue={data.topIssue}
            canManage={canManage}
            schemaMissing={data.schemaMissing}
          />
        </TabsContent>
        <TabsContent value="brief">
          <BriefPane data={data} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function WarRoom({ data, canReply }: { data: MediaCommandData; canReply: boolean }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 lg:grid-cols-3">
        {data.calls.map((call) => (
          <Link key={call.id} href={call.href} className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <Card className="h-full transition-shadow hover:border-primary/40 hover:shadow-md">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-sm">{call.title}</CardTitle>
                  <Badge variant={CALL_VARIANT[call.severity] ?? "secondary"}>{call.severity}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-1 text-sm text-muted-foreground">
                <p>{call.reason}</p>
                <p className="font-medium text-foreground">{call.action}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Must-act queue</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.mustAct.length === 0 ? (
              <p className="text-sm text-muted-foreground">No pending, flagged, or misinfo comments in the latest inbox page.</p>
            ) : (
              data.mustAct.map((comment) => (
                <MustActRow key={comment.id} comment={comment} team={data.team} canReply={canReply} />
              ))
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Issue heat</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {data.issueHeat.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sync comments to see topics.</p>
              ) : (
                data.issueHeat.map((issue) => (
                  <div key={issue.topic} className="flex items-center justify-between gap-2 text-sm">
                    <span className="capitalize">{issue.topic}</span>
                    <Badge variant="secondary">{issue.count}</Badge>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Last posts</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.lastPosts.length === 0 ? (
                <p className="text-sm text-muted-foreground">No Facebook posts synced yet.</p>
              ) : (
                data.lastPosts.map((post) => (
                  <div key={post.id} className="space-y-1 rounded-lg border border-border p-3">
                    <p className="text-sm">{post.content || "(no caption)"}</p>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      {post.posted_at ? <span>{formatDate(post.posted_at)}</span> : null}
                      <span className="inline-flex items-center gap-1"><Heart className="h-3 w-3" /> {formatNumber(post.likes)}</span>
                      <span className="inline-flex items-center gap-1"><MessageSquare className="h-3 w-3" /> {formatNumber(post.comments_count)}</span>
                      <span className="inline-flex items-center gap-1"><Share2 className="h-3 w-3" /> {formatNumber(post.shares)}</span>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
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

  async function assign(userId: string) {
    setLoading("assign");
    const result = await assignComment(comment.id, userId || null);
    setLoading(null);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Assigned");
    router.refresh();
  }

  return (
    <div className="rounded-lg border border-border p-3">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="font-medium text-sm text-foreground">{displayFacebookAuthor(comment.author_name)}</span>
        {comment.is_misinformation ? <Badge variant="destructive">Misinfo</Badge> : null}
        <Badge variant={comment.status === "flagged" ? "destructive" : "warning"}>{comment.status}</Badge>
        {comment.issue_topic && comment.issue_topic !== "other" ? (
          <Badge variant="secondary">{comment.issue_topic}</Badge>
        ) : null}
        {comment.priority_score >= 70 ? <Badge variant="destructive">P{comment.priority_score}</Badge> : null}
      </div>
      <p className="mt-2 text-sm">{comment.content}</p>
      <div className="mt-2 flex flex-wrap gap-1">
        <Button size="sm" variant="outline" asChild>
          <Link href="/comments">Open inbox</Link>
        </Button>
        {canReply ? (
          <>
            <Button size="sm" variant="outline" onClick={() => { setReplyOpen(true); setReplyText(""); }}>
              <Reply className="h-3 w-3" /> Reply
            </Button>
            <Button size="sm" variant="outline" disabled={loading === "suggest"} onClick={suggest}>
              {loading === "suggest" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Bot className="h-3 w-3" />}
              AI Reply
            </Button>
            {team.length > 0 ? (
              <NativeSelect className="h-8 w-auto text-xs" defaultValue="" onChange={(e) => assign(e.target.value)}>
                <option value="" disabled>Assign…</option>
                {team.map((member) => (
                  <option key={member.id} value={member.id}>{member.full_name}</option>
                ))}
              </NativeSelect>
            ) : null}
          </>
        ) : null}
      </div>

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
            <Button variant="outline" onClick={suggest} disabled={!!loading}>Suggest with AI</Button>
            <Button onClick={sendReply} disabled={!!loading || !replyText.trim()}>
              {loading === "reply" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Post reply
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CalendarPane({
  items,
  topIssue,
  canManage,
  schemaMissing,
}: {
  items: MediaContent[];
  topIssue: string | null;
  canManage: boolean;
  schemaMissing: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [topic, setTopic] = useState(topIssue && ISSUE_TOPICS.includes(topIssue as (typeof ISSUE_TOPICS)[number]) ? topIssue : "");
  const [talking, setTalking] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");

  const grouped = useMemo(() => {
    const order: MediaContentStatus[] = ["draft", "approved", "scheduled", "posted", "killed"];
    return order.map((status) => ({ status, rows: items.filter((item) => item.status === status) }));
  }, [items]);

  function submit(form?: { title: string; body: string; issue_topic?: string; talking_points?: string[]; scheduled_at?: string }) {
    start(async () => {
      const result = await createMediaContent({
        title: form?.title ?? title,
        body: form?.body ?? body,
        issue_topic: form?.issue_topic ?? (topic || null),
        talking_points: form?.talking_points ?? talking.split("\n").map((line) => line.trim()).filter(Boolean),
        scheduled_at: form?.scheduled_at ?? (scheduledAt || null),
      });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Draft saved");
      setTitle("");
      setBody("");
      setTalking("");
      setScheduledAt("");
      router.refresh();
    });
  }

  function draftIssue(issue: string) {
    start(async () => {
      const result = await draftFromIssue(issue);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(`Drafted “${result.title ?? issue}”`);
      router.refresh();
    });
  }

  return (
    <div className="grid gap-4 xl:grid-cols-3">
      <Card className="xl:col-span-1">
        <CardHeader>
          <CardTitle className="text-base">New post</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {topIssue ? (
            <Button
              type="button"
              className="w-full"
              disabled={!canManage || pending || schemaMissing}
              onClick={() => draftIssue(topIssue)}
            >
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Draft a {topIssue} post
            </Button>
          ) : null}
          <div className="space-y-1">
            <Label htmlFor="media-title">Title</Label>
            <Input id="media-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="On roads" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="media-body">Body</Label>
            <textarea
              id="media-body"
              className="min-h-[120px] w-full rounded-md border border-border bg-background p-3 text-sm"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={280}
              placeholder="Under 280 characters. No invented promises."
            />
            <p className="text-xs text-muted-foreground">{body.length}/280</p>
          </div>
          <div className="space-y-1">
            <Label htmlFor="media-topic">Issue</Label>
            <NativeSelect id="media-topic" value={topic} onChange={(e) => setTopic(e.target.value)}>
              <option value="">No topic</option>
              {ISSUE_TOPICS.filter((item) => item !== "other").map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </NativeSelect>
          </div>
          <div className="space-y-1">
            <Label htmlFor="media-points">Talking points (one per line)</Label>
            <textarea
              id="media-points"
              className="min-h-[80px] w-full rounded-md border border-border bg-background p-3 text-sm"
              value={talking}
              onChange={(e) => setTalking(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="media-when">Schedule (optional)</Label>
            <Input id="media-when" type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
          </div>
          <Button type="button" disabled={!canManage || pending || schemaMissing} onClick={() => submit()}>
            Save draft
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-4 xl:col-span-2">
        {grouped.map((group) => (
          <Card key={group.status}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base capitalize">{group.status}</CardTitle>
              <Badge variant={STATUS_VARIANT[group.status]}>{group.rows.length}</Badge>
            </CardHeader>
            <CardContent className="space-y-3">
              {group.rows.length === 0 ? (
                <p className="text-sm text-muted-foreground">None</p>
              ) : (
                group.rows.map((item) => (
                  <CalendarRow key={item.id} item={item} canManage={canManage} />
                ))
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function CalendarRow({ item, canManage }: { item: MediaContent; canManage: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [when, setWhen] = useState("");
  const nexts = MEDIA_TRANSITIONS[item.status];

  function move(to: MediaContentStatus) {
    start(async () => {
      const result = await updateMediaStatus(item.id, to, { scheduledAt: when || item.scheduled_at });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(`Moved to ${to}`);
      router.refresh();
    });
  }

  function markPosted() {
    start(async () => {
      const result = await markMediaPosted(item.id);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Marked posted");
      router.refresh();
    });
  }

  function publish() {
    start(async () => {
      const result = await publishMediaToFacebook(item.id);
      if ("error" in result && result.error) {
        toast.error(result.error);
        return;
      }
      if ("copyInstead" in result && result.copyInstead) {
        await copyText(item.body, "Copied body — Facebook could not publish. Paste in Meta Business Suite.");
        if (result.publishError) toast.message(result.publishError);
        return;
      }
      toast.success("published" in result && result.published ? "Published to Facebook" : "Saved");
      router.refresh();
    });
  }

  return (
    <div className="space-y-2 rounded-lg border border-border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-medium text-sm">{item.title}</p>
        {item.issue_topic ? <Badge variant="secondary">{item.issue_topic}</Badge> : null}
        <Badge variant="outline">{item.platform}</Badge>
      </div>
      <p className="text-sm text-muted-foreground whitespace-pre-wrap">{item.body}</p>
      {item.talking_points.length > 0 ? (
        <ul className="list-disc pl-5 text-xs text-muted-foreground">
          {item.talking_points.map((point) => <li key={point}>{point}</li>)}
        </ul>
      ) : null}
      {item.scheduled_at ? (
        <p className="text-xs text-muted-foreground">Scheduled {formatDate(item.scheduled_at)}</p>
      ) : null}
      <div className="flex flex-wrap gap-1">
        <Button size="sm" variant="outline" onClick={() => copyText(item.body, "Copied for Meta Business Suite")}>
          <Copy className="h-3 w-3" /> Copy body
        </Button>
        {canManage && item.status !== "posted" && item.status !== "killed" ? (
          <>
            <Input
              type="datetime-local"
              className="h-8 w-auto text-xs"
              value={when}
              onChange={(e) => setWhen(e.target.value)}
            />
            {nexts.includes("approved") ? (
              <Button size="sm" variant="outline" disabled={pending} onClick={() => move("approved")}>Approve</Button>
            ) : null}
            {nexts.includes("scheduled") ? (
              <Button size="sm" variant="outline" disabled={pending} onClick={() => move("scheduled")}>Schedule</Button>
            ) : null}
            {nexts.includes("draft") ? (
              <Button size="sm" variant="outline" disabled={pending} onClick={() => move("draft")}>Back to draft</Button>
            ) : null}
            {nexts.includes("posted") ? (
              <Button size="sm" variant="outline" disabled={pending} onClick={markPosted}>
                <CheckCircle className="h-3 w-3" /> Mark posted
              </Button>
            ) : null}
            <Button size="sm" variant="outline" disabled={pending} onClick={publish}>
              Publish if token allows
            </Button>
            {nexts.includes("killed") ? (
              <Button size="sm" variant="ghost" disabled={pending} onClick={() => move("killed")}>Kill</Button>
            ) : null}
          </>
        ) : null}
        {canManage && item.status === "killed" ? (
          <Button size="sm" variant="outline" disabled={pending} onClick={() => move("draft")}>Restore draft</Button>
        ) : null}
      </div>
    </div>
  );
}

function BriefPane({ data }: { data: MediaCommandData }) {
  const { brief } = data;
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between space-y-0">
          <div>
            <CardTitle className="text-base">Daily media brief</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">{brief.mediaLine}</p>
          </div>
          <Button variant="outline" onClick={() => copyText(brief.huddleText, "Huddle copied for WhatsApp")}>
            <Copy className="h-4 w-4" /> Copy for WhatsApp
          </Button>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>{brief.summary}</p>
          <div className="flex flex-wrap gap-2">
            <Badge variant="success">Positive {brief.sentimentBreakdown.positive}%</Badge>
            <Badge variant="secondary">Neutral {brief.sentimentBreakdown.neutral}%</Badge>
            <Badge variant="destructive">Negative {brief.sentimentBreakdown.negative}%</Badge>
            <Badge variant="warning">{brief.pending} pending</Badge>
            <Badge variant="outline">{brief.flagged} flagged</Badge>
            <Badge variant="destructive">{brief.misinfo} misinfo</Badge>
          </div>
          <div className="flex flex-wrap gap-1">
            {brief.topIssues.map((issue) => (
              <Badge key={issue} variant="secondary">{issue}</Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Best post (7 days)</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {brief.bestPost ? (
              <>
                <p className="text-foreground">{brief.bestPost.content || "(no caption)"}</p>
                <p className="mt-2">{brief.bestPost.likes} likes · {brief.bestPost.comments_count} comments · {brief.bestPost.shares} shares</p>
              </>
            ) : (
              <p>No Facebook post in the last 7 days.</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Watch (weakest, 7 days)</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {brief.worstPost ? (
              <>
                <p className="text-foreground">{brief.worstPost.content || "(no caption)"}</p>
                <p className="mt-2">{brief.worstPost.likes} likes · {brief.worstPost.comments_count} comments</p>
              </>
            ) : (
              <p>Not enough posts to compare.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Next three posts</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {brief.nextPosts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No issue heat yet — keep replies moving instead of inventing a post.</p>
          ) : (
            brief.nextPosts.map((item, index) => (
              <div key={`${item.topic}-${index}`} className="rounded-lg border border-border p-3">
                <p className="text-sm font-medium capitalize">{index + 1}. {item.topic}</p>
                <p className="text-sm">{item.talkingPoint}</p>
                <p className="text-xs text-muted-foreground">{item.why}</p>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">WhatsApp huddle</CardTitle></CardHeader>
        <CardContent>
          <pre className="whitespace-pre-wrap rounded-md bg-muted p-3 text-sm">{brief.huddleText}</pre>
        </CardContent>
      </Card>
    </div>
  );
}
