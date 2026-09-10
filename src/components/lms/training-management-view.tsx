"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { GraduationCap, Download, MessageCircle } from "lucide-react";
import { PageHeader, StatCard } from "@/components/shared/page-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NativeSelect } from "@/components/ui/native-select";
import { ProgressBar } from "@/components/lms/progress-bar";
import {
  createLiveSession,
  duplicateCourse,
  exportTrainingCsv,
  saveCourseMeta,
  sendTrainingCodesWhatsApp,
  sendTrainingReminders,
  setCourseStatus,
} from "@/lib/lms/actions";
import { supportRoleShort } from "@/lib/lms/roles";
import { isOverdue, percentComplete } from "@/lib/lms/progress";
import { usePermissions } from "@/components/providers/auth-provider";

type Course = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  role_slug: string | null;
  status: string;
  pass_mark: number | null;
  max_attempts: number | null;
  estimated_minutes: number | null;
  is_required: boolean | null;
};

type CourseModule = {
  id: string;
  course_id: string;
  slug: string;
  title: string;
  kind: string;
  body: string | null;
  estimated_minutes: number | null;
  sort_order: number;
  quiz: { questions?: Array<{ id: string; prompt: string; choices: string[] }> } | null;
};

type Volunteer = {
  id: string;
  full_name: string;
  phone: string;
  lga?: string | null;
  ward?: string | null;
  support_roles?: string[];
  training_status: string;
  deployment_ready?: boolean;
  training_code?: string | null;
};

type Enrollment = {
  volunteer_id: string;
  course_id: string;
  status: string;
  due_at: string | null;
  required: boolean;
};

export function TrainingManagementView({
  stats,
  courses,
  volunteers,
  enrollments,
  byRole,
  byLga,
  overdue,
  sessions,
  logs,
  modules,
  learnBase,
  canWrite,
}: {
  stats: { total: number; trained: number; ready: number; overdue: number; inProgress: number };
  courses: Course[];
  volunteers: Volunteer[];
  enrollments: Enrollment[];
  byRole: Array<{ slug: string; name: string; total: number; ready: number; pct: number }>;
  byLga: Array<{ lga: string; total: number; ready: number; pct: number }>;
  overdue: Volunteer[];
  sessions: Array<{ id: string; title: string; starts_at: string; location: string | null; meeting_url: string | null; capacity: number | null }>;
  logs: Array<{ id: string; action: string; detail: string | null; created_at: string; volunteer_id: string | null }>;
  modules: CourseModule[];
  learnBase: string;
  canWrite: boolean;
}) {
  const router = useRouter();
  const { canCreate } = usePermissions();
  const [pending, start] = useTransition();
  const [filter, setFilter] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const enrollByVolunteer = useMemo(() => {
    const map = new Map<string, Enrollment[]>();
    for (const row of enrollments) {
      const list = map.get(row.volunteer_id) ?? [];
      list.push(row);
      map.set(row.volunteer_id, list);
    }
    return map;
  }, [enrollments]);

  const people = volunteers.filter((v) => {
    const q = filter.trim().toLowerCase();
    if (!q) return true;
    return `${v.full_name} ${v.phone} ${v.lga} ${v.ward}`.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Training Management"
        description="Role-based courses, live briefings, and who is ready for assignment"
      >
        {canWrite ? (
          <Button
            variant="secondary"
            onClick={() =>
              start(async () => {
                const ids = selectedIds.filter((id) => people.some((person) => person.id === id));
                const result = await sendTrainingCodesWhatsApp(ids.length ? ids : undefined);
                if ("error" in result && result.error) {
                  toast.error(result.error);
                  return;
                }
                const sent = "sent" in result ? result.sent : 0;
                const failed = "failed" in result ? result.failed : 0;
                toast.success(
                  failed
                    ? `WhatsApp codes sent to ${sent}. ${failed} failed.`
                    : `WhatsApp codes sent to ${sent} volunteer${sent === 1 ? "" : "s"}.`
                );
                router.refresh();
              })
            }
            disabled={pending}
          >
            <MessageCircle className="mr-2 h-4 w-4" />
            {selectedIds.length ? `Send codes (${selectedIds.length})` : "Send codes"}
          </Button>
        ) : null}
        {canCreate ? (
          <Button
            variant="secondary"
            onClick={() =>
              start(async () => {
                const result = await sendTrainingReminders();
                if ("error" in result && result.error) toast.error(result.error);
                else toast.success(`Reminders sent to ${"sent" in result ? result.sent : 0} overdue volunteers`);
                router.refresh();
              })
            }
            disabled={pending}
          >
            Send reminders
          </Button>
        ) : null}
        <Button
          variant="outline"
          onClick={() =>
            start(async () => {
              const result = await exportTrainingCsv();
              if ("error" in result && result.error) {
                toast.error(result.error);
                return;
              }
              const blob = new Blob([result.csv], { type: "text/csv" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = "volunteer-training.csv";
              a.click();
              URL.revokeObjectURL(url);
            })
          }
        >
          <Download className="mr-2 h-4 w-4" />
          Export
        </Button>
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard title="Volunteers" value={stats.total} icon={GraduationCap} />
        <StatCard title="Trained" value={stats.trained} />
        <StatCard title="Ready for assignment" value={stats.ready} />
        <StatCard title="In progress" value={stats.inProgress} />
        <StatCard title="Overdue" value={stats.overdue} />
      </div>

      {learnBase ? (
        <Card className="border-emerald-500/30 bg-emerald-500/5">
          <CardContent className="py-4 text-sm">
            Volunteer login: <span className="font-mono">{learnBase}</span>
            <span className="ml-2 text-muted-foreground">Phone + training code from signup or the volunteer profile.</span>
          </CardContent>
        </Card>
      ) : null}

      <Tabs defaultValue="courses">
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="courses">Courses</TabsTrigger>
          <TabsTrigger value="people">People</TabsTrigger>
          <TabsTrigger value="analytics">By role / LGA</TabsTrigger>
          <TabsTrigger value="sessions">Live sessions</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="people" className="space-y-3">
          <Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Search volunteers…" className="max-w-sm" />
          {canWrite ? (
            <p className="text-xs text-muted-foreground">
              Select rows and use Send codes to WhatsApp training logins. With none selected, every listed volunteer is sent (up to 200).
            </p>
          ) : null}
          {overdue.length > 0 ? (
            <p className="text-sm text-amber-600">{overdue.length} overdue. Filter the table or send reminders.</p>
          ) : null}
          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>
                  {canWrite ? (
                    <th className="p-3 w-10">
                      <input
                        type="checkbox"
                        aria-label="Select all volunteers"
                        checked={people.length > 0 && people.every((person) => selectedIds.includes(person.id))}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedIds(people.map((person) => person.id));
                          else setSelectedIds([]);
                        }}
                      />
                    </th>
                  ) : null}
                  <th className="p-3">Volunteer</th>
                  <th className="p-3">Roles</th>
                  <th className="p-3">Progress</th>
                  <th className="p-3">Ready</th>
                  <th className="p-3">Code</th>
                </tr>
              </thead>
              <tbody>
                {people.map((person) => {
                  const rows = enrollByVolunteer.get(person.id) ?? [];
                  const active = rows.filter((e) => e.status !== "removed");
                  const done = active.filter((e) => e.status === "completed").length;
                  const late = active.some((e) => isOverdue(e.due_at, e.status));
                  return (
                    <tr key={person.id} className="border-t">
                      {canWrite ? (
                        <td className="p-3">
                          <input
                            type="checkbox"
                            aria-label={`Select ${person.full_name}`}
                            checked={selectedIds.includes(person.id)}
                            onChange={(e) => {
                              setSelectedIds((current) =>
                                e.target.checked
                                  ? [...current, person.id]
                                  : current.filter((id) => id !== person.id)
                              );
                            }}
                          />
                        </td>
                      ) : null}
                      <td className="p-3">
                        <Link href={`/volunteers/${person.id}`} className="font-medium hover:underline">{person.full_name}</Link>
                        <p className="text-xs text-muted-foreground">{person.lga} · {person.ward}</p>
                      </td>
                      <td className="p-3">
                        <div className="flex flex-wrap gap-1">
                          {(person.support_roles ?? []).map((slug) => (
                            <Badge key={slug} variant="info">{supportRoleShort(slug)}</Badge>
                          ))}
                        </div>
                      </td>
                      <td className="p-3 min-w-[10rem]">
                        <ProgressBar value={percentComplete(done, active.length)} label={`${done}/${active.length}`} />
                        {late ? <p className="text-xs text-amber-600">Overdue</p> : null}
                      </td>
                      <td className="p-3">
                        {person.deployment_ready ? <Badge variant="success">Ready</Badge> : <Badge variant="warning">Not ready</Badge>}
                      </td>
                      <td className="p-3 font-mono text-xs">{person.training_code ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="courses" className="space-y-4">
          {courses.length === 0 ? (
            <p className="text-sm text-muted-foreground">No published courses yet. Refresh after the catalog SQL has been applied.</p>
          ) : null}
          {courses.map((course) => {
            const courseModules = modules
              .filter((m) => m.course_id === course.id)
              .sort((a, b) => a.sort_order - b.sort_order);
            const quizzes = courseModules.filter((m) => m.kind === "quiz");
            return (
            <Card key={course.id}>
              <CardHeader className="flex flex-row items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-base">{course.title}</CardTitle>
                  <p className="text-sm text-muted-foreground">{course.description}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {course.role_slug ? supportRoleShort(course.role_slug) : "All roles"} · {course.estimated_minutes} min · pass {course.pass_mark}% · {course.max_attempts} attempts · {courseModules.length} modules · {quizzes.length} {quizzes.length === 1 ? "quiz" : "quizzes"}
                  </p>
                </div>
                <Badge variant={course.status === "published" ? "success" : "secondary"}>{course.status}</Badge>
              </CardHeader>
              <CardContent className="space-y-4">
                <ol className="space-y-3 text-sm">
                  {courseModules.map((courseModule, index) => (
                    <li key={courseModule.id} className="rounded-md border border-border px-3 py-2">
                      <p className="font-medium">
                        {index + 1}. {courseModule.title}
                        <span className="ml-2 text-xs font-normal uppercase text-muted-foreground">{courseModule.kind}</span>
                      </p>
                      {courseModule.kind === "quiz" ? (
                        <ul className="mt-2 space-y-2 text-muted-foreground">
                          {(courseModule.quiz?.questions ?? []).map((question, qIndex) => (
                            <li key={question.id}>
                              <p>{qIndex + 1}. {question.prompt}</p>
                              <p className="text-xs">{(question.choices ?? []).map((choice, cIndex) => `${String.fromCharCode(65 + cIndex)}. ${choice}`).join(" · ")}</p>
                            </li>
                          ))}
                        </ul>
                      ) : courseModule.body ? (
                        <p className="mt-1 text-muted-foreground">{courseModule.body}</p>
                      ) : null}
                    </li>
                  ))}
                </ol>
                {canWrite ? (
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => start(async () => { await setCourseStatus(course.id, course.status === "published" ? "archived" : "published"); router.refresh(); })}>
                    {course.status === "published" ? "Archive" : "Publish"}
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => start(async () => { await duplicateCourse(course.id); toast.success("Draft copy created"); router.refresh(); })}>
                    Duplicate
                  </Button>
                  <form
                    className="flex flex-wrap items-end gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const data = new FormData(e.currentTarget);
                      start(async () => {
                        const result = await saveCourseMeta(course.id, data);
                        if ("error" in result) toast.error(result.error);
                        else toast.success("Course saved");
                        router.refresh();
                      });
                    }}
                  >
                    <div className="space-y-1">
                      <Label className="text-xs">Pass mark</Label>
                      <Input name="pass_mark" type="number" defaultValue={course.pass_mark ?? 70} className="w-20" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Retries</Label>
                      <Input name="max_attempts" type="number" defaultValue={course.max_attempts ?? 3} className="w-20" />
                    </div>
                    <input type="hidden" name="title" value={course.title} />
                    <input type="hidden" name="description" value={course.description ?? ""} />
                    <input type="hidden" name="estimated_minutes" value={String(course.estimated_minutes ?? 20)} />
                    {course.is_required ? <input type="hidden" name="is_required" value="on" /> : null}
                    <Button size="sm" type="submit">Save rules</Button>
                  </form>
                </div>
                ) : null}
              </CardContent>
            </Card>
            );
          })}
        </TabsContent>

        <TabsContent value="analytics" className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle className="text-base">Completion by role</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {byRole.map((row) => (
                <ProgressBar key={row.slug} value={row.pct} label={`${row.name} (${row.ready}/${row.total})`} />
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Completion by LGA</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {byLga.map((row) => (
                <ProgressBar key={row.lga} value={row.pct} label={`${row.lga} (${row.ready}/${row.total})`} />
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sessions" className="space-y-4">
          {canWrite ? (
            <Card>
              <CardHeader><CardTitle className="text-base">Create live session</CardTitle></CardHeader>
              <CardContent>
                <form
                  className="grid gap-3 sm:grid-cols-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const data = new FormData(e.currentTarget);
                    start(async () => {
                      const result = await createLiveSession(data);
                      if ("error" in result) toast.error(result.error);
                      else {
                        toast.success("Session created");
                        e.currentTarget.reset();
                        router.refresh();
                      }
                    });
                  }}
                >
                  <div className="space-y-1 sm:col-span-2"><Label>Title</Label><Input name="title" required /></div>
                  <div className="space-y-1"><Label>Starts</Label><Input name="starts_at" type="datetime-local" required /></div>
                  <div className="space-y-1"><Label>Capacity</Label><Input name="capacity" type="number" min={1} /></div>
                  <div className="space-y-1"><Label>Location</Label><Input name="location" /></div>
                  <div className="space-y-1"><Label>Meeting link</Label><Input name="meeting_url" /></div>
                  <div className="space-y-1 sm:col-span-2">
                    <Label>Course (optional)</Label>
                    <NativeSelect name="course_id">
                      <option value="">None</option>
                      {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
                    </NativeSelect>
                  </div>
                  <div className="space-y-1 sm:col-span-2"><Label>Follow-up materials</Label><Input name="follow_up" /></div>
                  <Button type="submit" disabled={pending}>Create session</Button>
                </form>
              </CardContent>
            </Card>
          ) : null}
          {sessions.map((session) => (
            <Card key={session.id}>
              <CardContent className="pt-6">
                <p className="font-medium">{session.title}</p>
                <p className="text-sm text-muted-foreground">
                  {new Date(session.starts_at).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" })}
                  {session.location ? ` · ${session.location}` : ""}
                  {session.capacity ? ` · cap ${session.capacity}` : ""}
                </p>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="activity" className="space-y-2">
          {logs.map((log) => (
            <div key={log.id} className="rounded-lg border border-border px-3 py-2 text-sm">
              <p className="font-medium">{log.action.replace("training.", "").replace(/_/g, " ")}</p>
              <p className="text-muted-foreground">{log.detail}</p>
              <p className="text-xs text-muted-foreground">{new Date(log.created_at).toLocaleString("en-NG")}</p>
            </div>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}
