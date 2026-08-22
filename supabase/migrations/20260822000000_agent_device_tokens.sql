-- Device tokens for the Expo Agent app (Android first, iOS later).
-- Idempotent.

CREATE TABLE IF NOT EXISTS agent_device_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  platform TEXT NOT NULL DEFAULT 'android',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_device_tokens_user
  ON agent_device_tokens (tenant_id, user_id);

ALTER TABLE agent_device_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS agent_device_tokens_self ON agent_device_tokens;
CREATE POLICY agent_device_tokens_self ON agent_device_tokens
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.agent_device_tokens TO service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.agent_device_tokens TO authenticated;
