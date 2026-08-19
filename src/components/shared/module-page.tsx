import { notFound } from "next/navigation";
import { ModulePlaceholder } from "@/components/shared/page-shell";
import { getModule } from "@/lib/modules-config";

export function ModulePage({ slug }: { slug: string }) {
  const config = getModule(slug);
  if (!config) notFound();

  return (
    <ModulePlaceholder
      title={config.title}
      description={config.description}
      features={config.features}
    />
  );
}
