/** Preset campaign event types. Stored as snake_case slugs; labels are for HQ UI. */
export const EVENT_TYPE_OPTIONS = [
  { value: "town_hall", label: "Town hall" },
  { value: "rally", label: "Rally" },
  { value: "family_meeting", label: "Family meeting" },
  { value: "lga_meeting", label: "LGA meeting" },
  { value: "ward_meeting", label: "Ward meeting" },
  { value: "unit_meeting", label: "Unit meeting" },
  { value: "door_to_door", label: "Door to door" },
  { value: "fundraising_dinner", label: "Fundraising dinner" },
  { value: "press_conference", label: "Press conference" },
] as const;

export type PresetEventType = (typeof EVENT_TYPE_OPTIONS)[number]["value"];

export const CUSTOM_EVENT_TYPE_VALUE = "__custom__";

/** SQL to let HQ use new + custom event types (enum → text). */
export const EVENT_TYPE_TEXT_MIGRATION_SQL = `-- CCC: allow preset + custom campaign event types
ALTER TABLE public.campaign_events
  ALTER COLUMN event_type TYPE TEXT USING event_type::text;

ALTER TABLE public.campaign_events
  ALTER COLUMN event_type SET DEFAULT 'town_hall';

ALTER TABLE public.campaign_events
  DROP CONSTRAINT IF EXISTS campaign_events_event_type_nonempty;

ALTER TABLE public.campaign_events
  ADD CONSTRAINT campaign_events_event_type_nonempty
  CHECK (char_length(btrim(event_type)) > 0);

DROP TYPE IF EXISTS public.event_type;
`;

export function labelForEventType(value: string | null | undefined): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "Event";
  const preset = EVENT_TYPE_OPTIONS.find((o) => o.value === raw);
  if (preset) return preset.label;
  return raw.replace(/_/g, " ");
}

/** Normalize select value or free-typed label to a storage slug / custom string. */
export function normalizeEventType(raw: FormDataEntryValue | string | null | undefined): string {
  const input = String(raw ?? "").trim();
  if (!input || input === CUSTOM_EVENT_TYPE_VALUE) return "town_hall";

  const byValue = EVENT_TYPE_OPTIONS.find((o) => o.value === input);
  if (byValue) return byValue.value;

  const byLabel = EVENT_TYPE_OPTIONS.find(
    (o) => o.label.toLowerCase() === input.toLowerCase()
  );
  if (byLabel) return byLabel.value;

  const slug = input
    .toLowerCase()
    .replace(/[\s-]+/g, "_")
    .replace(/[^a-z0-9_]/g, "")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");

  return slug || "town_hall";
}

export function isInvalidEventTypeEnumError(message: string | undefined): boolean {
  if (!message) return false;
  const text = message.toLowerCase();
  return (
    text.includes("invalid input value for enum event_type") ||
    (text.includes("event_type") && text.includes("enum"))
  );
}
