-- Faster lookup of which polling units already have an agent.

CREATE INDEX IF NOT EXISTS idx_polling_units_assigned_agent
  ON polling_units (tenant_id, assigned_agent_id)
  WHERE assigned_agent_id IS NOT NULL;
