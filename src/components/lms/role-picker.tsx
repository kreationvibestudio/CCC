import { VOLUNTEER_SUPPORT_ROLES } from "@/lib/lms/roles";

export function RolePicker({
  name = "support_roles",
  selected = [],
  disabled = false,
}: {
  name?: string;
  selected?: string[];
  disabled?: boolean;
}) {
  return (
    <fieldset className="space-y-2" disabled={disabled}>
      <legend className="text-sm font-medium">Areas you want to support</legend>
      <p className="text-xs text-muted-foreground">Pick one or more. We assign the matching learning path.</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {VOLUNTEER_SUPPORT_ROLES.map((role) => (
          <label key={role.slug} className="flex items-start gap-2 rounded-md border border-border px-3 py-2 text-sm">
            <input
              type="checkbox"
              name={name}
              value={role.slug}
              defaultChecked={selected.includes(role.slug)}
              className="mt-0.5 h-4 w-4 rounded border-input"
            />
            <span>{role.name}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
