-- Baseline for a clean campaign: one tenant + Edo geography.
-- No sample volunteers, CRM, comments, events, social stubs, or SMS.
-- Polling units come from: npm run pu:import (supabase/data/edo-polling-units.csv)

INSERT INTO tenants (id, name, slug, election_date, campaign_end_date, fundraising_goal)
VALUES (
  'a0000000-0000-0000-0000-000000000001',
  'Campaign',
  'campaign',
  NULL,
  NULL,
  0
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  slug = EXCLUDED.slug,
  election_date = EXCLUDED.election_date,
  campaign_end_date = EXCLUDED.campaign_end_date,
  fundraising_goal = EXCLUDED.fundraising_goal;

INSERT INTO states (id, code, name) VALUES
  ('b0000000-0000-0000-0000-000000000001', 'ED', 'Edo')
ON CONFLICT (id) DO NOTHING;

INSERT INTO lgas (id, state_id, code, name) VALUES
  ('c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'ENE', 'Esan North-East'),
  ('c0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', 'ESE', 'Esan South-East')
ON CONFLICT (id) DO NOTHING;

INSERT INTO wards (id, lga_id, code, name) VALUES
  ('d0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'W01', 'Uromi I'),
  ('d0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001', 'W02', 'Irrua'),
  ('d0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000001', 'W03', 'Ewu'),
  ('d0000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000002', 'W01', 'Ugboha'),
  ('d0000000-0000-0000-0000-000000000005', 'c0000000-0000-0000-0000-000000000002', 'W02', 'Ewohimi')
ON CONFLICT (id) DO NOTHING;
