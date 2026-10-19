-- Ward coordinators may also act as polling-unit field agents (HQ + Agent Portal).
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS also_field_agent BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN profiles.also_field_agent IS
  'When true and role is ward_coordinator, user keeps HQ ward views and also gets Field Agent / PU access';
