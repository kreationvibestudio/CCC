-- Field agents can mark a unit as voting finished (before results are uploaded).
-- Idempotent. PostgreSQL 15+ (Supabase).

ALTER TYPE pu_status ADD VALUE IF NOT EXISTS 'voting_finished';
