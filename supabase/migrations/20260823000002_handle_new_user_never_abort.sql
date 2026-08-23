-- HQ Auth admin createUser must never fail because handle_new_user raised.
-- Public app registration stays closed in Next.js; HQ sets app_metadata.
-- Safe to re-run. Grants are ignored when the role does not exist.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  assigned_role user_role;
  assigned_tenant uuid;
BEGIN
  BEGIN
    assigned_tenant := NULLIF(
      btrim(COALESCE(NEW.raw_app_meta_data->>'tenant_id', NEW.raw_user_meta_data->>'tenant_id', '')),
      ''
    )::uuid;
  EXCEPTION WHEN OTHERS THEN
    assigned_tenant := NULL;
  END;

  IF assigned_tenant IS NULL THEN
    SELECT id INTO assigned_tenant FROM public.tenants ORDER BY created_at LIMIT 1;
  END IF;

  BEGIN
    assigned_role := NULLIF(
      btrim(COALESCE(NEW.raw_app_meta_data->>'role', NEW.raw_user_meta_data->>'role', '')),
      ''
    )::user_role;
  EXCEPTION WHEN OTHERS THEN
    assigned_role := 'supporter';
  END;
  IF assigned_role IS NULL THEN
    assigned_role := 'supporter';
  END IF;

  IF assigned_tenant IS NULL THEN
    RETURN NEW;
  END IF;

  BEGIN
    INSERT INTO public.profiles (id, tenant_id, email, full_name, role)
    VALUES (
      NEW.id,
      assigned_tenant,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
      assigned_role
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
