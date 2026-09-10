"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { updateVolunteerTraining } from "@/lib/volunteers/actions";
import { formatTrainedAt, type TrainingStatus } from "@/lib/volunteers/training";
import type { Volunteer } from "@/types/database";
import { TrainingBadge } from "@/components/volunteers/training-badge";

export function VolunteerTrainingCard({
  volunteer,
  canWrite,
}: {
  volunteer: Volunteer;
  canWrite: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [notes, setNotes] = useState(volunteer.training_notes ?? "");
  const trainedOn = formatTrainedAt(volunteer.trained_at);

  function apply(status: TrainingStatus) {
    startTransition(async () => {
      const result = await updateVolunteerTraining(volunteer.id, { status, notes });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(
        status === "completed"
          ? "Marked trained after the campaign briefing"
          : status === "in_progress"
            ? "Training marked in progress"
            : "Training reset to pending"
      );
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle>Training</CardTitle>
            <CardDescription>
              One campaign briefing. Coordinators mark people trained after they attend.
            </CardDescription>
          </div>
          <TrainingBadge status={volunteer.training_status} />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          {volunteer.training_status === "completed" && trainedOn
            ? `Trained on ${trainedOn}`
            : volunteer.training_status === "completed"
              ? "Marked trained. Date not recorded."
              : volunteer.training_status === "in_progress"
                ? "Briefing started; not yet completed."
                : "Needs the campaign briefing."}
        </p>
        <div className="space-y-1.5">
          <Label htmlFor="training_notes">Notes</Label>
          <textarea
            id="training_notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={!canWrite || pending}
            rows={3}
            placeholder="Optional: who briefed them, venue, or follow-up"
            className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          />
        </div>
        {canWrite ? (
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              disabled={pending}
              onClick={() => apply("completed")}
            >
              Mark trained
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={pending}
              onClick={() => apply("in_progress")}
            >
              In progress
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => apply(volunteer.training_status)}
            >
              Save notes
            </Button>
            {volunteer.training_status !== "pending" ? (
              <Button
                type="button"
                variant="ghost"
                disabled={pending}
                onClick={() => apply("pending")}
              >
                Reset to pending
              </Button>
            ) : null}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Read-only. Volunteer coordinators update briefing status.</p>
        )}
      </CardContent>
    </Card>
  );
}
