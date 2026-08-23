-- HQ Invite user / PU Agent create must work even when tenant_invites was never
-- applied. Prefer a consumed invite when the table exists; otherwise use
-- tenant_id + role from Auth user_metadata (service-role createUser). Public
-- app registration stays closed in the Next.js signUp action.

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
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'current_tenant_id'
  ) THEN
    EXECUTE $p$CREATE POLICY tenant_invites_select ON tenant_invites
      FOR SELECT USING (tenant_id = public.current_tenant_id())$p$;
  ELSE
    EXECUTE $p$CREATE POLICY tenant_invites_select ON tenant_invites
      FOR SELECT USING (
        tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
      )$p$;
  END IF;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.tenant_invites TO service_role;
GRANT SELECT ON TABLE public.tenant_invites TO authenticated;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  assigned_role user_role;
  assigned_tenant uuid;
  token text;
  profile_count integer;
  meta_role text;
  meta_tenant text;
  invite_id uuid;
  invite_role user_role;
  invite_tenant uuid;
BEGIN
  token := NULLIF(btrim(COALESCE(NEW.raw_user_meta_data->>'invite_token', '')), '');

  IF to_regclass('public.tenant_invites') IS NOT NULL THEN
    IF token IS NOT NULL THEN
      EXECUTE
        'SELECT id, tenant_id, role FROM public.tenant_invites
         WHERE token = $1 AND used_at IS NULL AND expires_at > now()
           AND lower(email) = lower($2)
         FOR UPDATE'
      INTO invite_id, invite_tenant, invite_role
      USING token, NEW.email;
    END IF;

    IF invite_id IS NULL THEN
      EXECUTE
        'SELECT id, tenant_id, role FROM public.tenant_invites
         WHERE lower(email) = lower($1) AND used_at IS NULL AND expires_at > now()
         ORDER BY created_at DESC
         LIMIT 1
         FOR UPDATE'
      INTO invite_id, invite_tenant, invite_role
      USING NEW.email;
    END IF;

    IF invite_id IS NOT NULL THEN
      assigned_tenant := invite_tenant;
      assigned_role := invite_role;
      EXECUTE 'UPDATE public.tenant_invites SET used_at = now() WHERE id = $1' USING invite_id;
    END IF;
  END IF;

  IF assigned_tenant IS NULL THEN
    meta_tenant := NULLIF(btrim(COALESCE(NEW.raw_user_meta_data->>'tenant_id', '')), '');
    meta_role := NULLIF(btrim(COALESCE(NEW.raw_user_meta_data->>'role', '')), '');
    IF meta_tenant IS NOT NULL AND meta_role IS NOT NULL THEN
      assigned_tenant := meta_tenant::uuid;
      assigned_role := meta_role::user_role;
    END IF;
  END IF;

  IF assigned_tenant IS NULL THEN
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
