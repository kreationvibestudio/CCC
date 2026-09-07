-- Signup hardening: a self-service Auth signup must never choose its own tenant
-- or role.
--
-- raw_user_meta_data is the `options.data` payload of supabase.auth.signUp, so
-- anyone holding the public anon key can set it. The previous revision read
-- role + tenant_id from it, which let an unauthenticated caller mint a
-- super_administrator profile in any workspace. Only two sources may assign
-- tenant + role now:
--
--   1. the tenant_invites ledger (created by an authenticated HQ user), and
--   2. raw_app_meta_data, which only the Auth admin API (service role) can write.
--
-- Everything else creates the Auth user with no profile. No profile means no
-- tenant and no permissions, and assembleAuthUser() treats the session as
-- unauthenticated. The function still never RAISEs: an exception here surfaces
-- as "Database error creating new user" and breaks HQ invites.
--
-- Safe to re-run.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role user_role;
  v_tenant uuid;
  v_token text;
  v_invite_id uuid;
  v_profile_count integer;
BEGIN
  -- 1. Invite ledger. Prefer an explicit token, then any pending invite for
  -- this email so HQ-created logins still resolve without a join link.
  IF to_regclass('public.tenant_invites') IS NOT NULL THEN
    BEGIN
      v_token := NULLIF(btrim(COALESCE(NEW.raw_user_meta_data->>'invite_token', '')), '');

      IF v_token IS NOT NULL THEN
        SELECT i.id, i.tenant_id, i.role
          INTO v_invite_id, v_tenant, v_role
        FROM public.tenant_invites i
        WHERE i.token = v_token
          AND i.used_at IS NULL
          AND i.expires_at > now()
          AND lower(i.email) = lower(NEW.email)
        FOR UPDATE;
      END IF;

      IF v_invite_id IS NULL THEN
        SELECT i.id, i.tenant_id, i.role
          INTO v_invite_id, v_tenant, v_role
        FROM public.tenant_invites i
        WHERE lower(i.email) = lower(NEW.email)
          AND i.used_at IS NULL
          AND i.expires_at > now()
        ORDER BY i.created_at DESC
        LIMIT 1
        FOR UPDATE;
      END IF;

      IF v_invite_id IS NOT NULL THEN
        UPDATE public.tenant_invites SET used_at = now() WHERE id = v_invite_id;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      v_invite_id := NULL;
      v_tenant := NULL;
      v_role := NULL;
    END;
  END IF;

  -- 2. Service-role provisioning via the Auth admin API.
  IF v_tenant IS NULL THEN
    BEGIN
      v_tenant := NULLIF(btrim(COALESCE(NEW.raw_app_meta_data->>'tenant_id', '')), '')::uuid;
      v_role := NULLIF(btrim(COALESCE(NEW.raw_app_meta_data->>'role', '')), '')::user_role;
    EXCEPTION WHEN OTHERS THEN
      v_tenant := NULL;
      v_role := NULL;
    END;
  END IF;

  -- 3. Bootstrap the very first account on a fresh instance. The advisory lock
  -- serialises concurrent first signups so exactly one can win the role.
  IF v_tenant IS NULL THEN
    BEGIN
      PERFORM pg_advisory_xact_lock(hashtext('public.handle_new_user:bootstrap'));
      SELECT count(*) INTO v_profile_count FROM public.profiles;
      IF v_profile_count = 0 THEN
        SELECT id INTO v_tenant FROM public.tenants ORDER BY created_at LIMIT 1;
        v_role := 'super_administrator';
      END IF;
    EXCEPTION WHEN OTHERS THEN
      v_tenant := NULL;
      v_role := NULL;
    END;
  END IF;

  IF v_tenant IS NULL THEN
    RETURN NEW;
  END IF;

  IF v_role IS NULL THEN
    v_role := 'supporter';
  END IF;

  BEGIN
    INSERT INTO public.profiles (id, tenant_id, email, full_name, role)
    VALUES (
      NEW.id,
      v_tenant,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
      v_role
    )
    ON CONFLICT (id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN NEW;
END;
$$;

DO $$
BEGIN
  BEGIN
    ALTER FUNCTION public.handle_new_user() OWNER TO postgres;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  BEGIN
    GRANT INSERT, UPDATE, SELECT ON TABLE public.profiles TO supabase_auth_admin;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  BEGIN
    GRANT USAGE ON TYPE public.user_role TO supabase_auth_admin;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
END $$;
