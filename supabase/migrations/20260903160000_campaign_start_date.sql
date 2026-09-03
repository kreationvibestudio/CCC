-- Add campaign_start_date to tenants so HQ can track when the campaign began.
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS campaign_start_date TIMESTAMPTZ;

-- Seed the known campaign timeline (safe to re-run).
UPDATE tenants SET
  campaign_start_date = COALESCE(campaign_start_date, '2026-08-19T00:00:00+01:00'),
  campaign_end_date   = COALESCE(campaign_end_date, '2027-01-14T23:59:59+01:00'),
  election_date       = COALESCE(election_date, '2027-01-16T00:00:00+01:00')
WHERE slug = 'campaign';
