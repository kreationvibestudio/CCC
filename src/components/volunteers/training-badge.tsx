import { Badge } from "@/components/ui/badge";
import { trainingBadgeVariant, trainingStatusLabel } from "@/lib/volunteers/training";

export function TrainingBadge({ status }: { status: string | null | undefined }) {
  return <Badge variant={trainingBadgeVariant(status)}>{trainingStatusLabel(status)}</Badge>;
}
