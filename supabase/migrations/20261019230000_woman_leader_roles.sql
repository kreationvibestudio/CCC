-- Woman leader hierarchy roles for HQ invites.
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'ward_woman_leader';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'unit_woman_leader';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'lga_woman_leader';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'senatorial_woman_leader';
