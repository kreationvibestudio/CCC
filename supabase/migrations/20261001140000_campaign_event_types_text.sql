-- Allow preset + custom campaign event types (was a closed Postgres enum).
-- Presets used by HQ: town_hall, rally, family_meeting, lga_meeting, ward_meeting,
-- unit_meeting, door_to_door, fundraising_dinner, press_conference — plus free text.

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
