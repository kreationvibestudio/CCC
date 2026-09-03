-- Add campaign_start_date to tenants so HQ can track when the campaign began.
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS campaign_start_date TIMESTAMPTZ;
