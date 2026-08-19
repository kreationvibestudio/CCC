-- Promote an existing Auth user to super administrator.
-- 1. Authentication → Users → Add user (your real email, Auto Confirm ON)
-- 2. Replace YOUR_EMAIL below, then run this in SQL Editor

INSERT INTO public.profiles (id, tenant_id, email, full_name, role)
SELECT
  id,
  'a0000000-0000-0000-0000-000000000001',
  email,
  COALESCE(raw_user_meta_data->>'full_name', split_part(email, '@', 1)),
  'super_administrator'::user_role
FROM auth.users
WHERE email = 'YOUR_EMAIL'
ON CONFLICT (id) DO UPDATE SET
  tenant_id = EXCLUDED.tenant_id,
  full_name = EXCLUDED.full_name,
  role = EXCLUDED.role;
