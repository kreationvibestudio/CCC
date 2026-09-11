-- Allow Campaign CRM to label volunteer signups as Support.
-- Safe to re-run: IF NOT EXISTS skips when the value is already present.
ALTER TYPE contact_type ADD VALUE IF NOT EXISTS 'supporter';
