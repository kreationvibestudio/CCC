-- Self-serve signup: first profile is super admin; everyone else is supporter.
-- Do not trust role from user metadata (that would let anyone become admin).

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  assigned_role user_role;
  profile_count integer;
BEGIN
  SELECT count(*) INTO profile_count FROM public.profiles;
  IF profile_count = 0 THEN
    assigned_role := 'super_administrator';
  ELSE
    assigned_role := 'supporter';
  END IF;

  INSERT INTO public.profiles (id, tenant_id, email, full_name, role)
  VALUES (
    NEW.id,
    COALESCE((NEW.raw_user_meta_data->>'tenant_id')::UUID, (SELECT id FROM public.tenants LIMIT 1)),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    assigned_role
  );
  RETURN NEW;
END;
$$;
