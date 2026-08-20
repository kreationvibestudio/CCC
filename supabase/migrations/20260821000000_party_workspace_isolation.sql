-- Party workspace isolation: lock identity, invite-only signup, tenant-scoped wipe,
-- WITH CHECK on remaining tables, platform operators, support sessions, PU clone.
-- Idempotent. Does not alter the existing NDC tenant's data.

-- ---------------------------------------------------------------------------
-- Invites (server-issued; signup trigger trusts these, never client tenant_id)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tenant_invites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'supporter',
  token TEXT NOT NULL UNIQUE,
  invited_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tenant_invites_email ON tenant_invites (lower(email));
CREATE INDEX IF NOT EXISTS idx_tenant_invites_tenant ON tenant_invites (tenant_id);

ALTER TABLE tenant_invites ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_invites_select ON tenant_invites;
CREATE POLICY tenant_invites_select ON tenant_invites
  FOR SELECT USING (tenant_id = public.current_tenant_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.tenant_invites TO service_role;
GRANT SELECT ON TABLE public.tenant_invites TO authenticated;

-- ---------------------------------------------------------------------------
-- Platform operators (vendor), not a party HQ role
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS platform_operators (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE platform_operators ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS platform_operators_self ON platform_operators;
CREATE POLICY platform_operators_self ON platform_operators
  FOR SELECT USING (user_id = auth.uid());

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.platform_operators TO service_role;
GRANT SELECT ON TABLE public.platform_operators TO authenticated;

CREATE TABLE IF NOT EXISTS platform_support_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  operator_id UUID NOT NULL REFERENCES platform_operators(user_id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  reason TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_support_sessions_operator
  ON platform_support_sessions (operator_id, ended_at, expires_at);

ALTER TABLE platform_support_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS platform_support_sessions_self ON platform_support_sessions;
CREATE POLICY platform_support_sessions_self ON platform_support_sessions
  FOR SELECT USING (operator_id = auth.uid());

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.platform_support_sessions TO service_role;
GRANT SELECT ON TABLE public.platform_support_sessions TO authenticated;

CREATE OR REPLACE FUNCTION public.is_platform_operator()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.platform_operators WHERE user_id = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION public.is_platform_operator() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_platform_operator() TO authenticated, service_role;

-- Support session takes precedence so vendor RLS sees the assumed workspace.
CREATE OR REPLACE FUNCTION public.current_tenant_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT s.tenant_id
      FROM public.platform_support_sessions s
      WHERE s.operator_id = auth.uid()
        AND s.ended_at IS NULL
        AND s.expires_at > now()
        AND EXISTS (
          SELECT 1 FROM public.platform_operators o WHERE o.user_id = auth.uid()
        )
      ORDER BY s.started_at DESC
      LIMIT 1
    ),
    (SELECT p.tenant_id FROM public.profiles p WHERE p.id = auth.uid())
  );
$$;

REVOKE ALL ON FUNCTION public.current_tenant_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_tenant_id() TO authenticated, service_role;

-- Platform operators may list workspaces (names only) for the vendor console.
DROP POLICY IF EXISTS tenant_select ON tenants;
CREATE POLICY tenant_select ON tenants
  FOR SELECT USING (
    id = public.current_tenant_id()
    OR public.is_platform_operator()
  );

-- ---------------------------------------------------------------------------
-- Lock profile identity columns (tenant, role, email, id)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.protect_profile_identity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;
  NEW.id := OLD.id;
  NEW.tenant_id := OLD.tenant_id;
  NEW.role := OLD.role;
  NEW.email := OLD.email;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_profile_identity ON profiles;
CREATE TRIGGER protect_profile_identity
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profile_identity();

DROP POLICY IF EXISTS profiles_update ON profiles;
CREATE POLICY profiles_update ON profiles
  FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- ---------------------------------------------------------------------------
-- Signup: invite only. Never trust metadata tenant_id or role.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  invite public.tenant_invites%ROWTYPE;
  assigned_role user_role;
  assigned_tenant uuid;
  token text;
  profile_count integer;
BEGIN
  token := NULLIF(btrim(COALESCE(NEW.raw_user_meta_data->>'invite_token', '')), '');

  IF token IS NOT NULL THEN
    SELECT * INTO invite
    FROM public.tenant_invites
    WHERE tenant_invites.token = token
      AND used_at IS NULL
      AND expires_at > now()
      AND lower(email) = lower(NEW.email)
    FOR UPDATE;
  END IF;

  IF invite.id IS NULL THEN
    SELECT * INTO invite
    FROM public.tenant_invites
    WHERE lower(email) = lower(NEW.email)
      AND used_at IS NULL
      AND expires_at > now()
    ORDER BY created_at DESC
    LIMIT 1
    FOR UPDATE;
  END IF;

  IF invite.id IS NOT NULL THEN
    assigned_tenant := invite.tenant_id;
    assigned_role := invite.role;
    UPDATE public.tenant_invites SET used_at = now() WHERE id = invite.id;
  ELSE
    SELECT count(*) INTO profile_count FROM public.profiles;
    IF profile_count = 0 THEN
      assigned_tenant := COALESCE(
        (SELECT id FROM public.tenants WHERE id = 'a0000000-0000-0000-0000-000000000001'),
        (SELECT id FROM public.tenants ORDER BY created_at LIMIT 1)
      );
      assigned_role := 'super_administrator';
    ELSE
      RAISE EXCEPTION 'Signup requires an invitation';
    END IF;
  END IF;

  IF assigned_tenant IS NULL THEN
    RAISE EXCEPTION 'Signup requires an invitation';
  END IF;

  INSERT INTO public.profiles (id, tenant_id, email, full_name, role)
  VALUES (
    NEW.id,
    assigned_tenant,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    assigned_role
  );
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- Explicit WITH CHECK on remaining tenant tables
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS tenant_isolation_polling_units ON polling_units;
CREATE POLICY tenant_isolation_polling_units ON polling_units
  FOR ALL USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS tenant_isolation_social_accounts ON social_accounts;
CREATE POLICY tenant_isolation_social_accounts ON social_accounts
  FOR ALL USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS tenant_isolation_social_posts ON social_posts;
CREATE POLICY tenant_isolation_social_posts ON social_posts
  FOR ALL USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS tenant_isolation_comments ON comments;
CREATE POLICY tenant_isolation_comments ON comments
  FOR ALL USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS tenant_isolation_volunteers ON volunteers;
CREATE POLICY tenant_isolation_volunteers ON volunteers
  FOR ALL USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS tenant_isolation_events ON campaign_events;
CREATE POLICY tenant_isolation_events ON campaign_events
  FOR ALL USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS tenant_isolation_message_templates ON message_templates;
CREATE POLICY tenant_isolation_message_templates ON message_templates
  FOR ALL USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS tenant_isolation_message_campaigns ON message_campaigns;
CREATE POLICY tenant_isolation_message_campaigns ON message_campaigns
  FOR ALL USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS campaign_locations_tenant ON campaign_locations;
CREATE POLICY campaign_locations_tenant ON campaign_locations
  FOR ALL USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS comment_notes_access ON comment_notes;
CREATE POLICY comment_notes_access ON comment_notes
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM comments c
      WHERE c.id = comment_id AND c.tenant_id = public.current_tenant_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM comments c
      WHERE c.id = comment_id AND c.tenant_id = public.current_tenant_id()
    )
  );

DROP POLICY IF EXISTS comment_responses_access ON comment_responses;
CREATE POLICY comment_responses_access ON comment_responses
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM comments c
      WHERE c.id = comment_id AND c.tenant_id = public.current_tenant_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM comments c
      WHERE c.id = comment_id AND c.tenant_id = public.current_tenant_id()
    )
  );

DROP POLICY IF EXISTS event_attendees_tenant ON event_attendees;
CREATE POLICY event_attendees_tenant ON event_attendees
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM campaign_events e
      WHERE e.id = event_id AND e.tenant_id = public.current_tenant_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM campaign_events e
      WHERE e.id = event_id AND e.tenant_id = public.current_tenant_id()
    )
  );

DROP POLICY IF EXISTS event_checkins_tenant ON event_checkins;
CREATE POLICY event_checkins_tenant ON event_checkins
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM campaign_events e
      WHERE e.id = event_id AND e.tenant_id = public.current_tenant_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM campaign_events e
      WHERE e.id = event_id AND e.tenant_id = public.current_tenant_id()
    )
  );

DROP POLICY IF EXISTS volunteer_attendance_access ON volunteer_attendance;
CREATE POLICY volunteer_attendance_access ON volunteer_attendance
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM volunteers v
      WHERE v.id = volunteer_id AND v.tenant_id = public.current_tenant_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM volunteers v
      WHERE v.id = volunteer_id AND v.tenant_id = public.current_tenant_id()
    )
  );

DROP POLICY IF EXISTS volunteer_checkins_access ON volunteer_checkins;
CREATE POLICY volunteer_checkins_access ON volunteer_checkins
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM volunteers v
      WHERE v.id = volunteer_id AND v.tenant_id = public.current_tenant_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM volunteers v
      WHERE v.id = volunteer_id AND v.tenant_id = public.current_tenant_id()
    )
  );

DROP POLICY IF EXISTS event_photos_tenant ON event_photos;
CREATE POLICY event_photos_tenant ON event_photos
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM campaign_events e
      WHERE e.id = event_id AND e.tenant_id = public.current_tenant_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM campaign_events e
      WHERE e.id = event_id AND e.tenant_id = public.current_tenant_id()
    )
  );

DROP POLICY IF EXISTS incident_media_tenant ON incident_media;
CREATE POLICY incident_media_tenant ON incident_media
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM incident_reports r
      WHERE r.id = incident_id AND r.tenant_id = public.current_tenant_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM incident_reports r
      WHERE r.id = incident_id AND r.tenant_id = public.current_tenant_id()
    )
  );

-- ---------------------------------------------------------------------------
-- Tenant-scoped wipe (never TRUNCATE all workspaces)
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.zero_operational_campaign_data();

CREATE OR REPLACE FUNCTION public.zero_operational_campaign_data(p_tenant_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET statement_timeout = '120s'
AS $$
DECLARE
  pu_count bigint;
BEGIN
  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'p_tenant_id is required';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.tenants WHERE id = p_tenant_id) THEN
    RAISE EXCEPTION 'Unknown workspace';
  END IF;

  DELETE FROM public.comment_notes
    WHERE comment_id IN (SELECT id FROM public.comments WHERE tenant_id = p_tenant_id);
  DELETE FROM public.comment_responses
    WHERE comment_id IN (SELECT id FROM public.comments WHERE tenant_id = p_tenant_id);
  DELETE FROM public.volunteer_attendance
    WHERE volunteer_id IN (SELECT id FROM public.volunteers WHERE tenant_id = p_tenant_id);
  DELETE FROM public.volunteer_checkins
    WHERE volunteer_id IN (SELECT id FROM public.volunteers WHERE tenant_id = p_tenant_id);
  DELETE FROM public.event_photos
    WHERE event_id IN (SELECT id FROM public.campaign_events WHERE tenant_id = p_tenant_id);
  DELETE FROM public.event_checkins
    WHERE event_id IN (SELECT id FROM public.campaign_events WHERE tenant_id = p_tenant_id);
  DELETE FROM public.event_attendees
    WHERE event_id IN (SELECT id FROM public.campaign_events WHERE tenant_id = p_tenant_id);
  DELETE FROM public.incident_media
    WHERE incident_id IN (SELECT id FROM public.incident_reports WHERE tenant_id = p_tenant_id);
  DELETE FROM public.contact_interactions
    WHERE contact_id IN (SELECT id FROM public.contacts WHERE tenant_id = p_tenant_id);

  DELETE FROM public.comments WHERE tenant_id = p_tenant_id;
  DELETE FROM public.social_posts WHERE tenant_id = p_tenant_id;
  DELETE FROM public.social_accounts WHERE tenant_id = p_tenant_id;
  DELETE FROM public.ai_analyses WHERE tenant_id = p_tenant_id;
  DELETE FROM public.ai_briefings WHERE tenant_id = p_tenant_id;
  DELETE FROM public.ai_suggestions WHERE tenant_id = p_tenant_id;
  DELETE FROM public.volunteer_tasks WHERE tenant_id = p_tenant_id;
  DELETE FROM public.volunteers WHERE tenant_id = p_tenant_id;
  DELETE FROM public.donations WHERE tenant_id = p_tenant_id;
  DELETE FROM public.contacts WHERE tenant_id = p_tenant_id;
  DELETE FROM public.campaign_events WHERE tenant_id = p_tenant_id;
  DELETE FROM public.incident_reports WHERE tenant_id = p_tenant_id;
  DELETE FROM public.election_results WHERE tenant_id = p_tenant_id;
  DELETE FROM public.agent_reports WHERE tenant_id = p_tenant_id;
  DELETE FROM public.polling_unit_status WHERE tenant_id = p_tenant_id;
  DELETE FROM public.messages WHERE tenant_id = p_tenant_id;
  DELETE FROM public.message_campaigns WHERE tenant_id = p_tenant_id;
  DELETE FROM public.message_templates WHERE tenant_id = p_tenant_id;
  DELETE FROM public.notifications WHERE tenant_id = p_tenant_id;
  DELETE FROM public.activities WHERE tenant_id = p_tenant_id;
  DELETE FROM public.audit_logs WHERE tenant_id = p_tenant_id;
  DELETE FROM public.tenant_settings
    WHERE tenant_id = p_tenant_id
      AND key NOT IN (
        'campaign_party',
        'paystack_payment_link',
        'facebook_page_id',
        'facebook_page_access_token',
        'facebook_user_access_token'
      );
  DELETE FROM public.campaign_locations WHERE tenant_id = p_tenant_id;
  DELETE FROM public.tenant_invites WHERE tenant_id = p_tenant_id AND used_at IS NULL;

  UPDATE public.polling_units
  SET assigned_agent_id = NULL, assigned_supervisor_id = NULL
  WHERE tenant_id = p_tenant_id;

  SELECT count(*) INTO pu_count FROM public.polling_units WHERE tenant_id = p_tenant_id;

  RETURN jsonb_build_object('ok', true, 'polling_units', pu_count, 'tenant_id', p_tenant_id);
END;
$$;

REVOKE ALL ON FUNCTION public.zero_operational_campaign_data(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.zero_operational_campaign_data(uuid) TO service_role;

-- ---------------------------------------------------------------------------
-- Clone INEC polling units into a new workspace (no agents / notes)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.clone_polling_units(p_source uuid, p_dest uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET statement_timeout = '10min'
AS $$
DECLARE
  copied bigint := 0;
BEGIN
  IF p_source IS NULL OR p_dest IS NULL OR p_source = p_dest THEN
    RAISE EXCEPTION 'source and destination workspaces are required and must differ';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.tenants WHERE id = p_source) THEN
    RAISE EXCEPTION 'Unknown source workspace';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.tenants WHERE id = p_dest) THEN
    RAISE EXCEPTION 'Unknown destination workspace';
  END IF;

  INSERT INTO public.polling_units (
    tenant_id, ward_id, code, name, ward, lga, state, registered_voters,
    latitude, longitude, address, risk_level, state_code, lg_code, ward_code,
    pu_code, geocode_status
  )
  SELECT
    p_dest, ward_id, code, name, ward, lga, state, registered_voters,
    latitude, longitude, address, 'low', state_code, lg_code, ward_code,
    pu_code, geocode_status
  FROM public.polling_units
  WHERE tenant_id = p_source
  ON CONFLICT (tenant_id, code) DO NOTHING;

  GET DIAGNOSTICS copied = ROW_COUNT;
  RETURN jsonb_build_object('ok', true, 'copied', copied);
END;
$$;

REVOKE ALL ON FUNCTION public.clone_polling_units(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.clone_polling_units(uuid, uuid) TO service_role;

-- ---------------------------------------------------------------------------
-- Storage: private election-media, path {tenant_id}/...
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  INSERT INTO storage.buckets (id, name, public)
  VALUES ('election-media', 'election-media', false)
  ON CONFLICT (id) DO UPDATE SET public = false;

  DROP POLICY IF EXISTS election_media_select ON storage.objects;
  CREATE POLICY election_media_select ON storage.objects
    FOR SELECT TO authenticated
    USING (
      bucket_id = 'election-media'
      AND split_part(name, '/', 1) = public.current_tenant_id()::text
    );

  DROP POLICY IF EXISTS election_media_insert ON storage.objects;
  CREATE POLICY election_media_insert ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
      bucket_id = 'election-media'
      AND split_part(name, '/', 1) = public.current_tenant_id()::text
    );

  DROP POLICY IF EXISTS election_media_update ON storage.objects;
  CREATE POLICY election_media_update ON storage.objects
    FOR UPDATE TO authenticated
    USING (
      bucket_id = 'election-media'
      AND split_part(name, '/', 1) = public.current_tenant_id()::text
    )
    WITH CHECK (
      bucket_id = 'election-media'
      AND split_part(name, '/', 1) = public.current_tenant_id()::text
    );

  DROP POLICY IF EXISTS election_media_delete ON storage.objects;
  CREATE POLICY election_media_delete ON storage.objects
    FOR DELETE TO authenticated
    USING (
      bucket_id = 'election-media'
      AND split_part(name, '/', 1) = public.current_tenant_id()::text
    );
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN insufficient_privilege THEN NULL;
END $$;

NOTIFY pgrst, 'reload schema';
