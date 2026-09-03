import Link from "next/link";
import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {description && (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </div>
  );
}

export function StatCard({
  title,
  value,
  change,
  icon: Icon,
  className,
  href,
}: {
  title: string;
  value: string | number;
  change?: string;
  icon?: React.ComponentType<{ className?: string }>;
  className?: string;
  href?: string;
}) {
  const body = (
    <>
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
      </div>
      <p className="mt-2 text-2xl font-bold">{value}</p>
      {change && (
        <p className="mt-1 text-xs text-muted-foreground">{change}</p>
      )}
    </>
  );

  const styles = cn(
    "block rounded-xl border border-border bg-card p-4 shadow-sm transition-shadow hover:shadow-md",
    href && "cursor-pointer hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
    className
  );

  if (href) {
    return (
      <Link href={href} className={styles} aria-label={`${title}: ${value}`}>
        {body}
      </Link>
    );
  }

  return <div className={styles}>{body}</div>;
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border p-12 text-center">
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ModulePlaceholder({
  title,
  description,
  features,
}: {
  title: string;
  description: string;
  features: string[];
}) {
  return (
    <div className="space-y-6">
      <PageHeader title={title} description={description} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((feature) => (
          <div
            key={feature}
            className="rounded-lg border border-border bg-card p-4 text-sm"
          >
            {feature}
          </div>
        ))}
      </div>
    </div>
  );
}
