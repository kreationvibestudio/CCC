-- Run AFTER creating the admin user in Supabase Dashboard:
-- Authentication → Users → Add user
--   Email: admin@demo.campaign.ng
--   Password: DemoPassword123!
--   Auto Confirm User: ON

INSERT INTO public.profiles (id, tenant_id, email, full_name, role)
SELECT
  id,
  'a0000000-0000-0000-0000-000000000001',
  email,
  'Demo Admin',
  'super_administrator'::user_role
FROM auth.users
WHERE email = 'admin@demo.campaign.ng'
ON CONFLICT (id) DO UPDATE SET
  tenant_id = EXCLUDED.tenant_id,
  full_name = EXCLUDED.full_name,
  role = EXCLUDED.role;
