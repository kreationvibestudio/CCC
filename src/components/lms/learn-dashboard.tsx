"use client";

import Link from "next/link";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/lms/progress-bar";
import { logoutVolunteerLearn, retakeLearnCourse, rsvpLearnSession } from "@/lib/lms/learn";
import { recoverStaleServerAction } from "@/lib/stale-server-action";
import { percentComplete, estimateMinutesLeft, isOverdue, formatDue } from "@/lib/lms/progress";
import { useRouter } from "next/navigation";

type Path = {
  enrollment: { id: string; status: string; due_at: string | null; course_id: string; required: boolean };
  course: { id: string; title: string; description: string | null; estimated_minutes: number | null; role_slug: string | null } | undefined;
  modules: Array<{ id: string; estimated_minutes?: number | null }>;
  completed: number;
  total: number;
};

export function LearnDashboardView({
  slug,
  campaign,
  volunteer,
  roles,
  paths,
  certificates,
  sessions,
  rsvps,
}: {
  slug: string;
  campaign: string;
  volunteer: { full_name: string; deployment_ready?: boolean | null; training_status: string };
  roles: Array<{ slug: string; label: string }>;
  paths: Path[];
  certificates: Array<{ id: string; course_id: string; code: string; issued_at: string }>;
  sessions: Array<{
    id: string;
    title: string;
    starts_at: string;
    location: string | null;
    meeting_url: string | null;
    follow_up: string | null;
  }>;
  rsvps: Array<{ session_id: string; status: string }>;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const first = [...paths].sort((a, b) => (a.enrollment.status === "completed" ? 1 : 0) - (b.enrollment.status === "completed" ? 1 : 0))[0];
  const nextHref = first?.course ? `/learn/${slug}/courses/${first.course.id}` : null;
  const rsvpSet = new Set(rsvps.map((r) => r.session_id));
  const hasCertificates = certificates.length > 0;

  function retake(courseId: string) {
    if (!window.confirm("Retake this course from the start? Your certificate stays available.")) return;
    start(async () => {
      try {
        const result = await retakeLearnCourse(courseId);
        if ("error" in result && result.error) toast.error(result.error);
        else {
          toast.success("Course reset. Start from the first module.");
          router.refresh();
        }
      } catch (error) {
        if (recoverStaleServerAction(error)) return;
        toast.error("Could not reset this course. Refresh the page.");
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-500">Volunteer Training</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">Welcome, {volunteer.full_name.split(" ")[0]}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {campaign} · finish your path to become ready for assignment.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            start(async () => {
              try {
                await logoutVolunteerLearn();
                router.push(`/learn/${slug}/login`);
              } catch (error) {
                if (recoverStaleServerAction(error)) return;
                toast.error("Could not sign out. Refresh the page.");
              }
            })
          }
        >
          Sign out
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {volunteer.deployment_ready ? (
          <Badge variant="success">Ready for assignment</Badge>
        ) : (
          <Badge variant="warning">Training in progress</Badge>
        )}
        {roles.map((role) => (
          <Badge key={role.slug} variant="info">{role.label}</Badge>
        ))}
      </div>

      <Card className="border-emerald-500/30 bg-emerald-500/5">
        <CardHeader>
          <CardTitle className="text-base">Next step</CardTitle>
          <CardDescription>
            {volunteer.deployment_ready
              ? "Required training is complete. You can view your certificates below, or retake a course anytime."
              : first?.course
                ? `Continue ${first.course.title}`
                : "Your coordinator will assign a learning path shortly."}
          </CardDescription>
        </CardHeader>
        {nextHref && !volunteer.deployment_ready ? (
          <CardContent>
            <Button asChild>
              <Link href={nextHref}>Continue training</Link>
            </Button>
          </CardContent>
        ) : volunteer.deployment_ready && hasCertificates ? (
          <CardContent>
            <Button asChild>
              <a href="#certificates">View certificates</a>
            </Button>
          </CardContent>
        ) : null}
      </Card>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Your courses</h2>
        <p className="text-sm text-muted-foreground">
          Courses you have been assigned. Open a finished course to review it, or retake it from the start.
        </p>
        <div className="grid gap-3">
          {paths.map((path) => {
            if (!path.course) return null;
            const pct = percentComplete(path.completed, path.total);
            const remaining = estimateMinutesLeft(path.modules, new Set());
            const overdue = isOverdue(path.enrollment.due_at, path.enrollment.status);
            const done = path.enrollment.status === "completed";
            const cert = certificates.find((item) => item.course_id === path.course?.id);
            return (
              <Card key={path.enrollment.id} className={done ? "" : "transition-shadow hover:shadow-md"}>
                <CardContent className="space-y-3 pt-6">
                  {done ? (
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium">{path.course.title}</p>
                        <p className="text-xs text-muted-foreground">{path.course.description}</p>
                      </div>
                      <Badge variant="success">Done</Badge>
                    </div>
                  ) : (
                    <Link href={`/learn/${slug}/courses/${path.course.id}`} className="block">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-medium">{path.course.title}</p>
                          <p className="text-xs text-muted-foreground">{path.course.description}</p>
                        </div>
                        <Badge variant={overdue ? "warning" : "secondary"}>
                          {overdue ? "Overdue" : "In progress"}
                        </Badge>
                      </div>
                    </Link>
                  )}
                  <ProgressBar value={pct} label={`${path.completed}/${path.total} modules`} />
                  <p className="text-xs text-muted-foreground">
                    {path.course.estimated_minutes ?? remaining} min · due {formatDue(path.enrollment.due_at) ?? "open"}
                    {path.enrollment.required ? " · required" : ""}
                    {done ? " · certificate ready" : ""}
                  </p>
                  {done ? (
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/learn/${slug}/courses/${path.course.id}`}>Review course</Link>
                      </Button>
                      {cert ? (
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/learn/${slug}/certificate/${path.course.id}`}>View certificate</Link>
                        </Button>
                      ) : null}
                      <Button size="sm" disabled={pending} onClick={() => retake(path.course!.id)}>
                        Retake
                      </Button>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Live sessions</h2>
        {sessions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No upcoming live briefings yet.</p>
        ) : (
          sessions.map((session) => (
            <Card key={session.id}>
              <CardContent className="flex flex-col gap-3 pt-6 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium">{session.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(session.starts_at).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" })}
                    {session.location ? ` · ${session.location}` : ""}
                  </p>
                  {session.follow_up ? <p className="mt-1 text-xs text-muted-foreground">{session.follow_up}</p> : null}
                </div>
                {rsvpSet.has(session.id) ? (
                  <Badge variant="success">Registered</Badge>
                ) : (
                  <Button
                    size="sm"
                    disabled={pending}
                    onClick={() =>
                      start(async () => {
                        try {
                          const result = await rsvpLearnSession(session.id);
                          if ("error" in result) toast.error(result.error);
                          else {
                            toast.success("You are registered");
                            router.refresh();
                          }
                        } catch (error) {
                          if (recoverStaleServerAction(error)) return;
                          toast.error("Could not register. Refresh the page.");
                        }
                      })
                    }
                  >
                    Register
                  </Button>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </section>

      <section id="certificates" className="space-y-3">
        <h2 className="text-lg font-semibold">Your certificates</h2>
        {certificates.length === 0 ? (
          <p className="text-sm text-muted-foreground">Certificates appear here when you pass a course.</p>
        ) : (
          certificates.map((cert) => {
            const title = paths.find((p) => p.course?.id === cert.course_id)?.course?.title ?? "Course";
            const enrollment = paths.find((p) => p.course?.id === cert.course_id)?.enrollment;
            return (
              <Card key={cert.id}>
                <CardContent className="flex flex-col gap-3 pt-6 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-medium">{title}</p>
                    <p className="font-mono text-xs text-muted-foreground">{cert.code}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/learn/${slug}/certificate/${cert.course_id}`}>View</Link>
                    </Button>
                    {enrollment?.status === "completed" ? (
                      <Button size="sm" disabled={pending} onClick={() => retake(cert.course_id)}>
                        Retake course
                      </Button>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </section>
    </div>
  );
}
