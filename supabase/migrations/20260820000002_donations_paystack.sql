-- Idempotent Paystack charges: one row per gateway reference.
CREATE UNIQUE INDEX IF NOT EXISTS donations_payment_reference_uidx
  ON donations (payment_reference)
  WHERE payment_reference IS NOT NULL;
