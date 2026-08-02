import { notFound } from "next/navigation";
import { ModulePlaceholder } from "@/components/shared/page-shell";
import { getModule } from "@/lib/modules-config";

export function ModulePage({ slug }: { slug: string }) {
  const module = getModule(slug);
  if (!module) notFound();

  return (
    <ModulePlaceholder
      title={module.title}
      description={module.description}
      features={module.features}
    />
  );
}
