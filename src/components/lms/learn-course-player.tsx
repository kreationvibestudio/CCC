"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { completeLearnModule, submitLearnQuiz } from "@/lib/lms/learn";

type Module = {
  id: string;
  slug: string;
  title: string;
  kind: string;
  body: string | null;
  resource_url: string | null;
  estimated_minutes: number | null;
  quiz: { questions?: Array<{ id: string; prompt: string; choices: string[] }> } | null;
};

export function LearnCoursePlayer({
  slug,
  course,
  modules,
  completedIds,
  enrollmentStatus,
}: {
  slug: string;
  course: { id: string; title: string; pass_mark?: number | null; max_attempts?: number | null };
  modules: Module[];
  completedIds: string[];
  enrollmentStatus: string;
}) {
  const router = useRouter();
  const done = new Set(completedIds);
  const next = modules.find((m) => !done.has(m.id)) ?? modules[modules.length - 1];
  const [activeId, setActiveId] = useState(next?.id ?? modules[0]?.id);
  const active = modules.find((m) => m.id === activeId) ?? next;
  const [pending, start] = useTransition();
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState("");
  const [acked, setAcked] = useState(false);

  if (!active) return <p>No modules in this course.</p>;

  function finish(extra?: { acknowledgement?: string; assignmentNotes?: string }) {
    start(async () => {
      const result = await completeLearnModule({
        moduleId: active.id,
        acknowledgement: extra?.acknowledgement,
        assignmentNotes: extra?.assignmentNotes,
      });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Saved");
      const idx = modules.findIndex((m) => m.id === active.id);
      const upcoming = modules[idx + 1];
      if (upcoming) setActiveId(upcoming.id);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <Button variant="outline" size="sm" asChild>
          <Link href={`/learn/${slug}`}>Back</Link>
        </Button>
        {enrollmentStatus === "completed" ? <Badge variant="success">Course complete</Badge> : null}
      </div>
      <h1 className="text-2xl font-bold tracking-tight">{course.title}</h1>
      <ol className="grid gap-2 sm:grid-cols-2">
        {modules.map((module, index) => (
          <li key={module.id}>
            <button
              type="button"
              onClick={() => setActiveId(module.id)}
              className={`w-full rounded-lg border px-3 py-2 text-left text-sm ${
                module.id === active.id ? "border-primary bg-primary/10" : "border-border"
              }`}
            >
              <span className="text-xs text-muted-foreground">{index + 1}. {module.kind}</span>
              <p className="font-medium">{module.title}</p>
              {done.has(module.id) ? <Badge variant="success" className="mt-1">Done</Badge> : null}
            </button>
          </li>
        ))}
      </ol>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{active.title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {active.body ? <p className="whitespace-pre-line text-sm leading-relaxed">{active.body}</p> : null}
          {active.kind === "resource" && active.resource_url ? (
            <Button variant="outline" asChild>
              <a href={active.resource_url} target="_blank" rel="noreferrer">Open material</a>
            </Button>
          ) : null}
          {active.kind === "acknowledgement" ? (
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" checked={acked} onChange={(e) => setAcked(e.target.checked)} className="mt-1" />
              I understand and will follow this.
            </label>
          ) : null}
          {active.kind === "assignment" ? (
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
              placeholder="Your short practice note"
            />
          ) : null}
          {active.kind === "quiz" ? (
            <div className="space-y-4">
              {(active.quiz?.questions ?? []).map((question) => (
                <fieldset key={question.id} className="space-y-2">
                  <legend className="text-sm font-medium">{question.prompt}</legend>
                  {question.choices.map((choice, index) => (
                    <label key={choice} className="flex items-center gap-2 text-sm">
                      <input
                        type="radio"
                        name={question.id}
                        checked={answers[question.id] === index}
                        onChange={() => setAnswers((prev) => ({ ...prev, [question.id]: index }))}
                      />
                      {choice}
                    </label>
                  ))}
                </fieldset>
              ))}
              <p className="text-xs text-muted-foreground">
                Pass mark {course.pass_mark ?? 70}% · up to {course.max_attempts ?? 3} attempts.
              </p>
              <Button
                disabled={pending || done.has(active.id)}
                onClick={() =>
                  start(async () => {
                    const result = await submitLearnQuiz({ moduleId: active.id, answers });
                    if (result.error) {
                      toast.error(result.error);
                      return;
                    }
                    toast[result.passed ? "success" : "error"](
                      result.passed
                        ? `Passed with ${result.score}%`
                        : `Score ${result.score}%. ${result.attempts}/${result.maxAttempts} attempts used.`
                    );
                    router.refresh();
                  })
                }
              >
                Submit quiz
              </Button>
            </div>
          ) : done.has(active.id) ? (
            <p className="text-sm text-emerald-600">Completed. You can revisit this anytime.</p>
          ) : (
            <Button
              disabled={pending}
              onClick={() =>
                finish({
                  acknowledgement: active.kind === "acknowledgement" && acked ? "I agree" : undefined,
                  assignmentNotes: active.kind === "assignment" ? notes : undefined,
                })
              }
            >
              Mark complete
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
