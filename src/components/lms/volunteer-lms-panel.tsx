"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { ProgressBar } from "@/components/lms/progress-bar";
import { assignHqCourse, removeHqCourse } from "@/lib/lms/actions";
import { percentComplete } from "@/lib/lms/progress";

export function VolunteerLmsPanel({
  volunteerId,
  trainingCode,
  deploymentReady,
  enrollments,
  courses,
  canWrite,
}: {
  volunteerId: string;
  trainingCode?: string | null;
  deploymentReady?: boolean;
  enrollments: Array<{ course_id: string; status: string; required: boolean; course?: { id: string; title: string } | undefined }>;
  courses: Array<{ id: string; title: string }>;
  canWrite: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const done = enrollments.filter((e) => e.status === "completed").length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>Learning path</CardTitle>
            <CardDescription>Required courses must finish before this person is ready for assignment.</CardDescription>
          </div>
          {deploymentReady ? <Badge variant="success">Ready for assignment</Badge> : <Badge variant="warning">Not ready</Badge>}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <ProgressBar value={percentComplete(done, enrollments.length)} label={`${done}/${enrollments.length} courses`} />
        {trainingCode ? (
          <p className="text-sm">Training code: <span className="font-mono">{trainingCode}</span></p>
        ) : null}
        <ul className="space-y-2 text-sm">
          {enrollments.map((row) => (
            <li key={row.course_id} className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2">
              <span>{row.course?.title ?? row.course_id} {row.required ? <span className="text-xs text-muted-foreground">(required)</span> : null}</span>
              <span className="flex items-center gap-2">
                <Badge variant={row.status === "completed" ? "success" : "secondary"}>{row.status}</Badge>
                {canWrite ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={pending}
                    onClick={() =>
                      start(async () => {
                        const result = await removeHqCourse(volunteerId, row.course_id);
                        if (result.error) toast.error(result.error);
                        router.refresh();
                      })
                    }
                  >
                    Remove
                  </Button>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
        {canWrite ? (
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const courseId = String(new FormData(e.currentTarget).get("course_id") ?? "");
              if (!courseId) return;
              start(async () => {
                const result = await assignHqCourse(volunteerId, courseId, false);
                if (result.error) toast.error(result.error);
                else toast.success("Course added");
                router.refresh();
              });
            }}
          >
            <NativeSelect name="course_id" className="flex-1">
              <option value="">Add a course…</option>
              {courses
                .filter((c) => !enrollments.some((e) => e.course_id === c.id))
                .map((c) => (
                  <option key={c.id} value={c.id}>{c.title}</option>
                ))}
            </NativeSelect>
            <Button type="submit" size="sm" disabled={pending}>Add</Button>
          </form>
        ) : null}
      </CardContent>
    </Card>
  );
}
